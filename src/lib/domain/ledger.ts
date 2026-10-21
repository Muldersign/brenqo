import type { BankAccount, BankTransaction, Customer, Expense, Invoice, Organization } from '../types';
import { amountPaid, documentTotals, invoiceTotal } from './calc';
import { round2 } from './money';
import { quarterRange, vatDeadline, vatSummary } from './vat';

/**
 * Year figures from the same records the rest of the app uses: sales
 * invoices, purchase invoices and receipts, and bank transactions that were
 * booked straight onto a category. No journal entries, no chart of accounts.
 */

/** Booked on a transaction but not income or a cost. */
export const NON_RESULT_CATEGORIES = ['Privé', 'Belastingen', 'Eigen overboeking'];

/** Categories for money coming in without an invoice. */
export function incomeCategories(kind: Organization['kind']) {
  return kind === 'association'
    ? ['Contributie', 'Sponsoring', 'Subsidie', 'Kantine-opbrengst', 'Donaties & acties', 'Rente', 'Overige baten']
    : ['Omzet', 'Rente', 'Overige opbrengsten'];
}

export interface LedgerInput {
  kind: Organization['kind'];
  /** Without VAT registration the VAT on costs can't be reclaimed, so it is part of the cost. */
  vatRegistered: boolean;
  invoices: Invoice[];
  expenses: Expense[];
  transactions: BankTransaction[];
  customers: Customer[];
}

export interface LedgerEntry {
  date: string;
  side: 'income' | 'cost';
  category: string;
  /** Excluding VAT where we know it. */
  amount: number;
  source: 'invoice' | 'expense' | 'bank';
  refId: string;
}

/** What an invoice is for, for an association by what kind of relation it went to. */
export function invoiceCategory(kind: Organization['kind'], customer: Customer | undefined) {
  if (kind !== 'association') return 'Omzet';
  const tags = (customer?.tags ?? []).map((t) => t.toLowerCase());
  if (tags.includes('sponsor')) return 'Sponsoring';
  if (tags.includes('lid')) return 'Contributie';
  return 'Overige baten';
}

export function ledgerEntries(d: LedgerInput, from: string, to: string): LedgerEntry[] {
  const customers = new Map(d.customers.map((c) => [c.id, c]));
  const out: LedgerEntry[] = [];
  for (const inv of d.invoices) {
    if (inv.state === 'draft' || inv.issueDate < from || inv.issueDate > to) continue;
    out.push({ date: inv.issueDate, side: 'income', category: invoiceCategory(d.kind, customers.get(inv.customerId)), amount: documentTotals(inv.lines).subtotal, source: 'invoice', refId: inv.id });
  }
  for (const e of d.expenses) {
    if (e.date < from || e.date > to) continue;
    out.push({ date: e.date, side: 'cost', category: e.category || 'Overig', amount: d.vatRegistered ? e.subtotal : e.total, source: 'expense', refId: e.id });
  }
  for (const t of d.transactions) {
    if (t.status !== 'categorized' || !t.category || NON_RESULT_CATEGORIES.includes(t.category)) continue;
    if (t.date < from || t.date > to) continue;
    out.push({ date: t.date, side: t.amount >= 0 ? 'income' : 'cost', category: t.category, amount: Math.abs(t.amount), source: 'bank', refId: t.id });
  }
  return out;
}

export interface StatementLine { category: string; amount: number }
export interface IncomeStatement {
  income: StatementLine[];
  costs: StatementLine[];
  totalIncome: number;
  totalCosts: number;
  result: number;
}

export function incomeStatement(entries: LedgerEntry[]): IncomeStatement {
  const group = (side: LedgerEntry['side']) => {
    const m = new Map<string, number>();
    for (const e of entries) if (e.side === side) m.set(e.category, (m.get(e.category) ?? 0) + e.amount);
    return [...m.entries()].map(([category, amount]) => ({ category, amount: round2(amount) })).sort((a, b) => b.amount - a.amount);
  };
  const income = group('income');
  const costs = group('cost');
  const totalIncome = round2(income.reduce((s, l) => s + l.amount, 0));
  const totalCosts = round2(costs.reduce((s, l) => s + l.amount, 0));
  return { income, costs, totalIncome, totalCosts, result: round2(totalIncome - totalCosts) };
}

export interface BalanceSheet {
  date: string;
  /** `known`: the imported history reaches back to `date`, so the balance can be walked back. */
  bank: { id: string; name: string; amount: number; known: boolean }[];
  totalBank: number;
  /** False when a bank balance on `date` can't be reconstructed. */
  complete: boolean;
  /** Still to receive from customers / members. */
  receivables: number;
  /** Still to pay to suppliers. */
  payables: number;
  /** VAT of quarters not yet due for filing on that date (negative: to reclaim). */
  vatPayable: number;
  equity: number;
}

/**
 * Position at the end of `date`. Bank balances are walked back from today's
 * balance; receivables and payables use payment dates where we have them.
 */
export function balanceSheet(d: LedgerInput & { accounts: BankAccount[] }, date: string, today = date): BalanceSheet {
  const bank = d.accounts.map((a) => {
    const own = d.transactions.filter((t) => t.accountId === a.id);
    const later = own.filter((t) => t.date > date).reduce((s, t) => s + t.amount, 0);
    const known = date >= today || own.some((t) => t.date <= date);
    return { id: a.id, name: a.name || a.bankName, amount: round2(a.balance - later), known };
  });
  const totalBank = round2(bank.reduce((s, b) => s + b.amount, 0));

  let receivables = 0;
  for (const inv of d.invoices) {
    if (inv.state === 'draft' || inv.state === 'credited' || inv.kind === 'credit' || inv.issueDate > date) continue;
    const paidLater = inv.payments.filter((p) => p.date > date).reduce((s, p) => s + p.amount, 0);
    receivables += Math.max(0, invoiceTotal(inv) - amountPaid(inv) + paidLater);
  }

  const txDate = new Map(d.transactions.map((t) => [t.id, t.date]));
  let payables = 0;
  for (const e of d.expenses) {
    if (e.kind !== 'invoice' || e.date > date) continue;
    const paidOn = e.transactionId ? txDate.get(e.transactionId) : undefined;
    const openAtDate = !e.paid || (paidOn !== undefined && paidOn > date);
    if (openAtDate) payables += e.total;
  }

  // Earlier quarters are assumed to be filed and paid.
  let vatPayable = 0;
  if (d.vatRegistered) {
    const y = Number(date.slice(0, 4));
    for (const [year, q] of [[y - 1, 4], [y, 1], [y, 2], [y, 3], [y, 4]]) {
      const r = quarterRange(year, q);
      if (r.from > date || vatDeadline(year, q) < date) continue;
      vatPayable += vatSummary(d.invoices, d.expenses, r.from, r.to < date ? r.to : date).balance;
    }
  }

  receivables = round2(receivables);
  payables = round2(payables);
  vatPayable = round2(vatPayable);
  return { date, bank, totalBank, complete: bank.every((b) => b.known), receivables, payables, vatPayable, equity: round2(totalBank + receivables - payables - vatPayable) };
}

/** Budget key per line of the income statement. */
export const budgetKey = (side: LedgerEntry['side'], category: string) => `${side}:${category}`;

export interface YearReport {
  year: number;
  /** Last day counted: 31 December, or today for the running year. */
  until: string;
  statement: IncomeStatement;
  previous: IncomeStatement;
  opening: BalanceSheet;
  closing: BalanceSheet;
  /** Money moved without being income or a cost (private, tax, own transfers). */
  otherMovements: number;
  /** Closing equity that the result and other movements don't explain (0 when the bank history is incomplete). */
  unexplained: number;
  /** Bank history covers the whole year. */
  complete: boolean;
  /** Earliest imported bank transaction. */
  historyFrom?: string;
}

export function yearReport(d: LedgerInput & { accounts: BankAccount[] }, year: number, today: string): YearReport {
  const until = `${year}-12-31` < today ? `${year}-12-31` : today;
  const statement = incomeStatement(ledgerEntries(d, `${year}-01-01`, until));
  const previous = incomeStatement(ledgerEntries(d, `${year - 1}-01-01`, `${year - 1}-12-31`));
  const opening = balanceSheet(d, `${year - 1}-12-31`, today);
  const closing = balanceSheet(d, until, today);
  const otherMovements = round2(
    d.transactions
      .filter((t) => t.status === 'categorized' && t.category && NON_RESULT_CATEGORIES.includes(t.category) && t.date >= `${year}-01-01` && t.date <= until)
      .reduce((s, t) => s + t.amount, 0),
  );
  const complete = opening.complete && closing.complete;
  const unexplained = complete ? round2(closing.equity - (opening.equity + statement.result + otherMovements)) : 0;
  const historyFrom = d.transactions.reduce<string | undefined>((min, t) => (!min || t.date < min ? t.date : min), undefined);
  return { year, until, statement, previous, opening, closing, otherMovements, unexplained, complete, historyFrom };
}

/** All category names on either side, in a stable order: this year by size, then the rest. */
export function statementCategories(side: 'income' | 'cost', reports: IncomeStatement[], budgets: Record<string, number>[]) {
  const names: string[] = [];
  const add = (n: string) => { if (!names.includes(n)) names.push(n); };
  for (const r of reports) (side === 'income' ? r.income : r.costs).forEach((l) => add(l.category));
  for (const b of budgets) Object.keys(b).filter((k) => k.startsWith(`${side}:`)).forEach((k) => add(k.slice(side.length + 1)));
  return names;
}
