import type { DocumentLine, Invoice, VatRate } from '../types';
import { round2 } from './money';

export function lineNet(line: Pick<DocumentLine, 'quantity' | 'unitPrice' | 'discountPct'>): number {
  const gross = line.quantity * line.unitPrice;
  return round2(gross * (1 - (line.discountPct || 0) / 100));
}

export interface Totals {
  subtotal: number;
  discount: number;
  vat: number;
  total: number;
  vatByRate: { rate: VatRate; base: number; vat: number }[];
}

/** Btw is calculated per rate over the summed line amounts (as on Dutch invoices). */
export function documentTotals(lines: DocumentLine[]): Totals {
  let subtotal = 0;
  let discount = 0;
  const byRate = new Map<VatRate, number>();
  for (const l of lines) {
    const gross = round2(l.quantity * l.unitPrice);
    const net = lineNet(l);
    subtotal += net;
    discount += gross - net;
    byRate.set(l.vatRate, (byRate.get(l.vatRate) ?? 0) + net);
  }
  const vatByRate = [...byRate.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([rate, base]) => ({ rate, base: round2(base), vat: round2((base * rate) / 100) }));
  const vat = round2(vatByRate.reduce((s, r) => s + r.vat, 0));
  subtotal = round2(subtotal);
  return { subtotal, discount: round2(discount), vat, total: round2(subtotal + vat), vatByRate };
}

export const invoiceTotal = (inv: Pick<Invoice, 'lines'>) => documentTotals(inv.lines).total;

export function amountPaid(inv: Pick<Invoice, 'payments'>): number {
  return round2(inv.payments.reduce((s, p) => s + p.amount, 0));
}

export function amountDue(inv: Invoice): number {
  // Credit notes settle themselves against the original invoice.
  if (inv.state === 'draft' || inv.state === 'credited' || inv.kind === 'credit') return 0;
  return round2(invoiceTotal(inv) - amountPaid(inv));
}

/** Split an amount incl. VAT into base and VAT. */
export function splitVat(totalInclVat: number, rate: VatRate) {
  const base = round2(totalInclVat / (1 + rate / 100));
  return { base, vat: round2(totalInclVat - base) };
}
