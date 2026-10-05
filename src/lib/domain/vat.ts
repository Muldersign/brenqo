import type { Expense, Invoice } from '../types';
import { documentTotals } from './calc';
import { round2 } from './money';
import { toISODate } from './dates';

export interface VatSummary {
  revenueExVat: number;
  vatReceived: number;
  costsExVat: number;
  vatPaid: number;
  balance: number;
  invoiceCount: number;
  expenseCount: number;
}

export function quarterRange(year: number, q: number) {
  const from = toISODate(new Date(year, (q - 1) * 3, 1));
  const to = toISODate(new Date(year, q * 3, 0));
  return { from, to };
}

/** Dutch VAT return deadline: last day of the month after the quarter. */
export function vatDeadline(year: number, q: number) {
  return toISODate(new Date(year, q * 3 + 1, 0));
}

/**
 * The return the user should be thinking about now: the quarter that just
 * ended while its filing month runs, otherwise the current quarter.
 */
export function relevantVatQuarter(today: string) {
  const d = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, Number(today.slice(8, 10)));
  const q = Math.floor(d.getMonth() / 3) + 1;
  const prevYear = q === 1 ? d.getFullYear() - 1 : d.getFullYear();
  const prevQ = q === 1 ? 4 : q - 1;
  if (today <= vatDeadline(prevYear, prevQ)) return { year: prevYear, q: prevQ };
  return { year: d.getFullYear(), q };
}

/**
 * Invoice-based ("factuurstelsel") summary: invoices count on their invoice
 * date, credit notes reduce revenue, drafts are ignored.
 */
export function vatSummary(invoices: Invoice[], expenses: Expense[], from: string, to: string): VatSummary {
  let revenueExVat = 0;
  let vatReceived = 0;
  let invoiceCount = 0;
  for (const inv of invoices) {
    if (inv.state === 'draft') continue;
    if (inv.issueDate < from || inv.issueDate > to) continue;
    const t = documentTotals(inv.lines);
    revenueExVat += t.subtotal;
    vatReceived += t.vat;
    invoiceCount++;
  }
  let costsExVat = 0;
  let vatPaid = 0;
  let expenseCount = 0;
  for (const e of expenses) {
    if (e.date < from || e.date > to) continue;
    costsExVat += e.subtotal;
    vatPaid += e.vatAmount;
    expenseCount++;
  }
  return {
    revenueExVat: round2(revenueExVat),
    vatReceived: round2(vatReceived),
    costsExVat: round2(costsExVat),
    vatPaid: round2(vatPaid),
    balance: round2(vatReceived - vatPaid),
    invoiceCount,
    expenseCount,
  };
}
