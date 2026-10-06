import type { Invoice, Quote } from '../types';
import type { DocumentData } from '@/components/documents/invoice-document';
import { amountPaid } from '../domain/calc';

export function invoiceToDocData(inv: Invoice): DocumentData {
  return {
    kind: inv.kind, number: inv.number, issueDate: inv.issueDate, dueDate: inv.dueDate, reference: inv.reference,
    lines: inv.lines, note: inv.note, paidAmount: inv.kind === 'invoice' ? amountPaid(inv) : 0,
  };
}

export function quoteToDocData(q: Quote): DocumentData {
  return { kind: 'quote', number: q.number, issueDate: q.issueDate, dueDate: q.validUntil, reference: q.reference, lines: q.lines, note: q.note };
}
