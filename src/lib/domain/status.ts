import type { Invoice, Quote } from '../types';
import { amountDue, amountPaid } from './calc';
import { daysBetween } from './dates';

export type InvoiceStatus =
  | 'draft'
  | 'sent'
  | 'viewed'
  | 'open'
  | 'paid'
  | 'partial'
  | 'overdue'
  | 'credited';

export const invoiceStatusLabel: Record<InvoiceStatus, string> = {
  draft: 'Concept',
  sent: 'Verzonden',
  viewed: 'Bekeken',
  open: 'Openstaand',
  paid: 'Betaald',
  partial: 'Deels betaald',
  overdue: 'Verlopen',
  credited: 'Gecrediteerd',
};

export function invoiceStatus(inv: Invoice, today: string): InvoiceStatus {
  if (inv.state === 'draft') return 'draft';
  if (inv.state === 'credited') return 'credited';
  if (inv.kind === 'credit') return inv.state === 'paid' ? 'paid' : 'open';
  if (amountDue(inv) <= 0.004) return 'paid';
  if (inv.dueDate < today) return 'overdue';
  if (amountPaid(inv) > 0) return 'partial';
  if (inv.state === 'viewed') return 'viewed';
  if (inv.state === 'sent') return 'sent';
  return 'open';
}

/** Is the money still expected to come in (for "Openstaand" totals)? */
export const isOutstanding = (s: InvoiceStatus) => s === 'sent' || s === 'viewed' || s === 'open' || s === 'partial' || s === 'overdue';

export function daysOverdue(inv: Invoice, today: string) {
  return Math.max(0, daysBetween(inv.dueDate, today));
}

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'expired' | 'invoiced';

export const quoteStatusLabel: Record<QuoteStatus, string> = {
  draft: 'Concept',
  sent: 'Verzonden',
  accepted: 'Geaccepteerd',
  declined: 'Afgewezen',
  expired: 'Verlopen',
  invoiced: 'Gefactureerd',
};

export function quoteStatus(q: Quote, today: string): QuoteStatus {
  if (q.invoiceId) return 'invoiced';
  if (q.state === 'accepted' || q.state === 'declined' || q.state === 'draft') return q.state;
  if (q.validUntil < today) return 'expired';
  return 'sent';
}
