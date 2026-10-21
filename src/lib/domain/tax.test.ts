import { describe, expect, it } from 'vitest';
import { DEFAULT_TAX_SETTINGS, estimateIncomeTax, projectYear, taxYear } from './tax';
import { balanceSheet, incomeStatement, ledgerEntries, yearReport, type LedgerInput } from './ledger';
import type { BankAccount, BankTransaction, Customer, Expense, Invoice } from '../types';

describe('income tax estimate', () => {
  it('applies deductions, credits and Zvw for 2026', () => {
    const e = estimateIncomeTax({ year: 2026, profit: 50000, settings: DEFAULT_TAX_SETTINGS });
    expect(e.selfEmployedDeduction).toBe(1200);
    expect(e.smeExemption).toBeCloseTo(6197.6, 1);
    expect(e.taxableProfit).toBeCloseTo(42602.4, 1);
    // 15,297.7 bracket tax − 2,291.8 general credit − 5,476.2 labour credit
    expect(e.incomeTax).toBeCloseTo(7529.7, 0);
    expect(e.zvw).toBeCloseTo(2066.2, 0);
    expect(e.remaining).toBeCloseTo(e.total, 2);
  });

  it('drops entrepreneur deductions without the hours criterion', () => {
    const e = estimateIncomeTax({ year: 2026, profit: 30000, settings: { ...DEFAULT_TAX_SETTINGS, hoursCriterion: false, starter: true } });
    expect(e.selfEmployedDeduction).toBe(0);
    expect(e.starterDeduction).toBe(0);
    expect(e.smeExemption).toBeCloseTo(3810, 0);
  });

  it('only counts the extra tax on top of a salary and caps Zvw', () => {
    const alone = estimateIncomeTax({ year: 2026, profit: 20000, settings: DEFAULT_TAX_SETTINGS });
    const withJob = estimateIncomeTax({ year: 2026, profit: 20000, settings: { ...DEFAULT_TAX_SETTINGS, otherIncome: 70000 } });
    expect(withJob.incomeTax).toBeGreaterThan(alone.incomeTax);
    expect(withJob.zvw).toBeCloseTo((79409 - 70000) * 0.0485, 0);
  });

  it('subtracts a provisional assessment and handles a loss', () => {
    expect(estimateIncomeTax({ year: 2026, profit: 40000, settings: { ...DEFAULT_TAX_SETTINGS, provisionalPaid: { 2026: 1000 } } }).provisionalPaid).toBe(1000);
    expect(estimateIncomeTax({ year: 2026, profit: -500, settings: DEFAULT_TAX_SETTINGS }).total).toBe(0);
  });

  it('falls back to known rates and projects the year', () => {
    expect(taxYear(2031).exact).toBe(false);
    expect(projectYear(1000, '2026-07-02', 2026)).toBeCloseTo(1994.5, 0);
    expect(projectYear(1000, '2027-03-01', 2026)).toBe(1000);
  });
});

const base = { organizationId: 'o' };
const inv = (id: string, customerId: string, date: string, amount: number, payments: { date: string; amount: number }[] = []): Invoice => ({
  ...base, id, kind: 'invoice', number: id, customerId, issueDate: date, dueDate: date, reference: '', note: '', state: payments.length ? 'paid' : 'sent',
  lines: [{ id: 'l', description: '', quantity: 1, unit: 'stuk', unitPrice: amount, vatRate: 0, discountPct: 0 }],
  payments: payments.map((p, i) => ({ id: `p${i}`, method: 'bank', note: '', source: 'bank', ...p })), publicToken: id, remindersEnabled: true, remindersSent: [], createdAt: date,
});
const cust = (id: string, tags: string[]) => ({ ...base, id, companyName: id, tags }) as unknown as Customer;
const exp = (id: string, date: string, total: number, category: string, paid: boolean, transactionId?: string): Expense => ({
  ...base, id, kind: 'invoice', supplierName: 's', invoiceNumber: '', date, subtotal: total, vatAmount: 0, total, vatRate: 0, category, description: '', iban: '',
  status: 'processed', paid, source: 'upload', document: { fileName: 'f.pdf', mimeType: 'application/pdf' }, transactionId, createdAt: date,
});
const tx = (id: string, date: string, amount: number, extra: Partial<BankTransaction> = {}): BankTransaction => ({
  ...base, id, accountId: 'a', date, description: '', counterparty: '', counterpartyIban: '', amount, status: 'matched', ...extra,
});

describe('association year figures', () => {
  const d: LedgerInput & { accounts: BankAccount[] } = {
    kind: 'association',
    vatRegistered: false,
    customers: [cust('lid', ['Lid']), cust('sponsor', ['Sponsor'])],
    invoices: [
      inv('c1', 'lid', '2026-09-01', 150, [{ date: '2026-09-05', amount: 150 }]),
      inv('c2', 'lid', '2026-09-01', 150),
      inv('s1', 'sponsor', '2026-08-20', 500, [{ date: '2027-01-10', amount: 500 }]),
    ],
    expenses: [exp('zaal', '2026-12-04', 410, 'Zaalhuur', true, 't2'), exp('bond', '2026-11-01', 200, 'Bondskosten', false)],
    transactions: [
      tx('t0', '2025-12-20', 0, { status: 'ignored' }),
      tx('t1', '2026-09-05', 150, { invoiceId: 'c1' }),
      tx('t2', '2027-01-03', -410, { expenseId: 'zaal' }),
      tx('t3', '2026-10-01', 1200, { status: 'categorized', category: 'Subsidie' }),
      tx('t4', '2027-01-10', 500, { invoiceId: 's1' }),
    ],
    accounts: [{ ...base, id: 'a', bankName: 'Rabobank', name: 'Vereniging', iban: '', balance: 2000, provider: 'import', connectedAt: '', lastSyncAt: '', consentValidUntil: '', color: '' }],
  };

  it('groups income by relation type and booked categories', () => {
    const st = incomeStatement(ledgerEntries(d, '2026-01-01', '2026-12-31'));
    expect(st.income).toEqual([{ category: 'Subsidie', amount: 1200 }, { category: 'Sponsoring', amount: 500 }, { category: 'Contributie', amount: 300 }]);
    expect(st.totalCosts).toBe(610);
    expect(st.result).toBe(1390);
  });

  it('builds the balance at year end using payment dates', () => {
    const b = balanceSheet(d, '2026-12-31');
    expect(b.totalBank).toBe(1910); // 2000 − 500 + 410
    expect(b.receivables).toBe(650); // c2 + s1 (paid in January)
    expect(b.payables).toBe(610); // bond + zaal (paid in January)
    expect(b.equity).toBe(1950);
  });

  it('explains the change in equity by the result', () => {
    const r = yearReport(d, 2026, '2027-02-01');
    expect(r.complete).toBe(true);
    expect(r.opening.equity).toBe(560);
    expect(r.unexplained).toBe(0);
  });

  it('flags an opening balance it cannot reconstruct', () => {
    const r = yearReport({ ...d, transactions: d.transactions.filter((t) => t.id !== 't0') }, 2026, '2027-02-01');
    expect(r.opening.complete).toBe(false);
    expect(r.complete).toBe(false);
    expect(r.historyFrom).toBe('2026-09-05');
  });
});
