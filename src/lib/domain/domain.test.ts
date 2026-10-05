import { describe, expect, it } from 'vitest';
import { documentTotals, amountDue, splitVat } from './calc';
import { formatDocNumber } from './numbering';
import { invoiceStatus } from './status';
import { scoreInvoiceMatch, bestInvoiceMatch, AUTO_MATCH_THRESHOLD } from './matching';
import { dueReminderStep } from './reminders';
import { dueRuns, nextOccurrence } from './recurring';
import { vatSummary, vatDeadline, relevantVatQuarter } from './vat';
import { guessCategory } from './categories';
import { parseAmount } from './money';
import { fillTemplate } from './template';
import { blankOrganization } from '../defaults';
import { createDemoData } from '../demo-data';
import type { BankTransaction, Customer, DocumentLine, Invoice, Supplier } from '../types';

const line = (p: Partial<DocumentLine>): DocumentLine => ({ id: 'l', description: 'x', quantity: 1, unit: 'stuk', unitPrice: 0, vatRate: 21, discountPct: 0, ...p });
const invoice = (p: Partial<Invoice> = {}): Invoice => ({
  id: 'i1', organizationId: 'o', kind: 'invoice', number: '2026-034', customerId: 'c1', issueDate: '2026-09-20', dueDate: '2026-10-04',
  reference: '', lines: [line({ unitPrice: 1000 })], note: '', state: 'sent', payments: [], publicToken: 'T', remindersEnabled: true,
  remindersSent: [], createdAt: '', ...p,
});
const customer: Customer = {
  id: 'c1', organizationId: 'o', companyName: 'De Leo Media', contactName: 'Leo', email: '', phone: '', address: '', postalCode: '', city: '',
  country: '', kvk: '', vatNumber: '', iban: 'NL20RABO0312345678', paymentTermDays: 14, defaultInvoiceText: '', remindersEnabled: true, tags: [], createdAt: '',
};
const tx = (p: Partial<BankTransaction>): BankTransaction => ({ id: 't', organizationId: 'o', accountId: 'a', date: '2026-10-05', description: '', counterparty: '', counterpartyIban: '', amount: 0, status: 'todo', ...p });

describe('invoice totals', () => {
  it('matches the example from the brief: 2 uur × €75 + hosting €180', () => {
    const t = documentTotals([line({ quantity: 2, unitPrice: 75, unit: 'uur' }), line({ unitPrice: 180, unit: 'jaar' })]);
    expect(t).toMatchObject({ subtotal: 330, vat: 69.3, total: 399.3 });
  });
  it('groups btw per rate and applies line discounts', () => {
    const t = documentTotals([line({ unitPrice: 100, discountPct: 10 }), line({ unitPrice: 50, vatRate: 9 })]);
    expect(t.subtotal).toBe(140);
    expect(t.discount).toBe(10);
    expect(t.vatByRate).toEqual([{ rate: 21, base: 90, vat: 18.9 }, { rate: 9, base: 50, vat: 4.5 }]);
  });
  it('splits an amount incl. btw (Praxis bon)', () => {
    expect(splitVat(52.89, 21)).toEqual({ base: 43.71, vat: 9.18 });
  });
  it('credit notes never count as outstanding', () => {
    expect(amountDue(invoice({ kind: 'credit', lines: [line({ quantity: -1, unitPrice: 100 })] }))).toBe(0);
  });
});

describe('numbering', () => {
  it('pads per administration prefix', () => {
    expect(formatDocNumber('2026-', 38)).toBe('2026-038');
    expect(formatDocNumber('VZ-2026-', 2)).toBe('VZ-2026-002');
  });
});

describe('status', () => {
  it('derives Verlopen, Deels betaald and Betaald', () => {
    expect(invoiceStatus(invoice(), '2026-10-05')).toBe('overdue');
    expect(invoiceStatus(invoice({ dueDate: '2026-10-10', payments: [{ id: 'p', date: '', amount: 200, method: 'bank', note: '', source: 'bank' }] }), '2026-10-05')).toBe('partial');
    expect(invoiceStatus(invoice({ payments: [{ id: 'p', date: '', amount: 1210, method: 'bank', note: '', source: 'bank' }] }), '2026-10-05')).toBe('paid');
    expect(invoiceStatus(invoice({ state: 'draft' }), '2026-10-05')).toBe('draft');
  });
});

describe('bank matching', () => {
  it('is very sure when amount, number and name match', () => {
    const m = scoreInvoiceMatch(tx({ amount: 1210, counterparty: 'De Leo Media', description: 'Factuur 2026-034' }), invoice(), customer);
    expect(m.confidence).toBeGreaterThanOrEqual(AUTO_MATCH_THRESHOLD);
  });
  it('only suggests (no auto) when just amount and name match', () => {
    const m = scoreInvoiceMatch(tx({ amount: 1210, counterparty: 'De Leo Media B.V.', description: 'betaling' }), invoice(), customer);
    expect(m.confidence).toBeGreaterThanOrEqual(45);
    expect(m.confidence).toBeLessThan(AUTO_MATCH_THRESHOLD);
  });
  it('ignores outgoing payments and unrelated amounts', () => {
    const map = new Map([[customer.id, customer]]);
    expect(bestInvoiceMatch(tx({ amount: -72.59 }), [invoice()], map)).toBeNull();
    expect(bestInvoiceMatch(tx({ amount: 13.37, counterparty: 'Iemand' }), [invoice()], map)).toBeNull();
  });
});

describe('reminders', () => {
  const org = blankOrganization('o', 'Test', 2026);
  it('sends the first reminder 3 days after the due date, then the second', () => {
    expect(dueReminderStep(invoice(), org, customer, '2026-10-06')).toBeNull();
    expect(dueReminderStep(invoice(), org, customer, '2026-10-07')?.id).toBe('r1');
    expect(dueReminderStep(invoice({ remindersSent: [{ stepId: 'r1', sentAt: '' }] }), org, customer, '2026-10-14')?.id).toBe('r2');
  });
  it('stops when paid or switched off', () => {
    expect(dueReminderStep(invoice({ state: 'paid', payments: [{ id: 'p', date: '', amount: 1210, method: 'bank', note: '', source: 'bank' }] }), org, customer, '2026-10-20')).toBeNull();
    expect(dueReminderStep(invoice({ remindersEnabled: false }), org, customer, '2026-10-20')).toBeNull();
    expect(dueReminderStep(invoice(), org, { ...customer, remindersEnabled: false }, '2026-10-20')).toBeNull();
  });
});

describe('recurring', () => {
  it('handles month ends and catches up missed runs', () => {
    expect(nextOccurrence('2026-01-31', 'monthly')).toBe('2026-02-28');
    expect(dueRuns('2026-08-01', 'monthly', '2026-10-05')).toEqual(['2026-08-01', '2026-09-01', '2026-10-01']);
    expect(dueRuns('2026-11-01', 'yearly', '2026-10-05')).toEqual([]);
  });
});

describe('btw', () => {
  it('computes the balance per quarter on invoice date', () => {
    const s = vatSummary([invoice({ issueDate: '2026-08-01' }), invoice({ state: 'draft', issueDate: '2026-08-02' })], [
      { id: 'e', organizationId: 'o', kind: 'receipt', supplierName: 'Praxis', invoiceNumber: '', date: '2026-09-01', subtotal: 43.71, vatAmount: 9.18, total: 52.89, vatRate: 21, category: 'Materiaal', description: '', iban: '', status: 'processed', paid: true, source: 'camera', document: { fileName: '', mimeType: '' }, createdAt: '' },
    ], '2026-07-01', '2026-09-30');
    expect(s).toMatchObject({ revenueExVat: 1000, vatReceived: 210, vatPaid: 9.18, balance: 200.82, invoiceCount: 1 });
  });
  it('knows the deadline and which return is due', () => {
    expect(vatDeadline(2026, 3)).toBe('2026-10-31');
    expect(relevantVatQuarter('2026-10-05')).toEqual({ year: 2026, q: 3 });
    expect(relevantVatQuarter('2026-11-05')).toEqual({ year: 2026, q: 4 });
    expect(relevantVatQuarter('2027-01-10')).toEqual({ year: 2026, q: 4 });
  });
});

describe('supplier recognition', () => {
  const suppliers: Supplier[] = [{ id: 's', organizationId: 'o', name: 'Adobe', defaultCategory: 'Software', defaultVatRate: 21, iban: '', email: '', website: '', timesUsed: 3 }];
  it('remembers earlier choices first', () => {
    expect(guessCategory('Adobe Systems Software Ireland', suppliers)).toMatchObject({ category: 'Software', source: 'memory' });
  });
  it('falls back to general knowledge', () => {
    expect(guessCategory('KPN B.V.', [])).toMatchObject({ category: 'Telefoon & internet', source: 'keyword' });
    expect(guessCategory('Shell Veendam', [])).toMatchObject({ category: 'Brandstof' });
    expect(guessCategory('Booking Holdings', [])).toMatchObject({ category: 'Overig', source: 'none' });
  });
});

describe('helpers', () => {
  it('parses Dutch amounts', () => {
    expect(parseAmount('1.210,50')).toBe(1210.5);
    expect(parseAmount('€ 52,89')).toBe(52.89);
    expect(parseAmount('1210.5')).toBe(1210.5);
  });
  it('fills e-mail templates', () => {
    expect(fillTemplate('Beste [naam], factuur [factuurnummer] [onbekend]', { naam: 'Leo', factuurnummer: '2026-034' })).toBe('Beste Leo, factuur 2026-034 [onbekend]');
  });
});

describe('demo data', () => {
  const d = createDemoData('2026-10-05');
  it('keeps administrations separated and numbering gapless', () => {
    const ms = d.invoices.filter((i) => i.organizationId === 'org_muldersign' && i.number.startsWith('2026-')).map((i) => i.number).sort();
    expect(ms[0]).toBe('2026-001');
    expect(ms.at(-1)).toBe('2026-037');
    expect(new Set(ms).size).toBe(37);
    expect(d.organizations.find((o) => o.id === 'org_muldersign')?.nextInvoiceNumber).toBe(38);
    const vz = d.invoices.filter((i) => i.organizationId === 'org_vz').map((i) => i.number);
    expect(vz.every((n) => n.startsWith('VZ-2026-'))).toBe(true);
    expect(d.organizations.find((o) => o.id === 'org_vz')?.nextInvoiceNumber).toBe(vz.length + 1);
  });
  it('every customer reference stays inside its administration', () => {
    const byId = new Map(d.customers.map((c) => [c.id, c.organizationId]));
    expect(d.invoices.every((i) => byId.get(i.customerId) === i.organizationId)).toBe(true);
  });
  it('has the invoices from the brief', () => {
    const find = (n: string) => d.invoices.find((i) => i.number === n)!;
    expect(documentTotals(find('2026-034').lines).total).toBe(1210);
    expect(documentTotals(find('2026-035').lines).total).toBe(847);
    expect(documentTotals(find('2026-036').lines).total).toBe(605);
    expect(invoiceStatus(find('2026-034'), '2026-10-05')).toBe('paid');
    expect(invoiceStatus(find('2026-036'), '2026-10-05')).toBe('overdue');
  });
});
