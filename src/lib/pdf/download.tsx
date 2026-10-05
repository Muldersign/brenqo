'use client';

import type { Customer, Invoice, Organization, Quote } from '../types';
import type { DocumentData } from '@/components/documents/invoice-document';
import { amountPaid } from '../domain/calc';

export function invoiceToDoc(inv: Invoice, creditOfNumber?: string): DocumentData {
  return {
    kind: inv.kind, number: inv.number, issueDate: inv.issueDate, dueDate: inv.dueDate, reference: inv.reference,
    lines: inv.lines, note: inv.note, paidAmount: inv.kind === 'invoice' ? amountPaid(inv) : 0, creditOfNumber,
  };
}

export function quoteToDoc(q: Quote): DocumentData {
  return { kind: 'quote', number: q.number, issueDate: q.issueDate, dueDate: q.validUntil, reference: q.reference, lines: q.lines, note: q.note };
}

/** Render the PDF in the browser (lazy-loaded, ~1 MB) and download it. */
export async function downloadPdf(org: Organization, customer: Customer | undefined, doc: DocumentData) {
  const [{ pdf }, { InvoicePdf }] = await Promise.all([import('@react-pdf/renderer'), import('./invoice-pdf')]);
  const blob = await pdf(<InvoicePdf org={org} customer={customer} doc={doc} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${doc.kind === 'quote' ? 'Offerte' : doc.kind === 'credit' ? 'Creditfactuur' : 'Factuur'} ${doc.number || 'concept'} - ${org.name}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
