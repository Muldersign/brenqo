import { renderToBuffer } from '@react-pdf/renderer';
import { NextResponse } from 'next/server';
import { InvoicePdf } from '@/lib/pdf/invoice-pdf';
import type { Customer, Organization } from '@/lib/types';
import type { DocumentData } from '@/components/documents/invoice-document';

export const runtime = 'nodejs';

/**
 * Server-side PDF rendering: POST { org, customer, doc } → application/pdf.
 * Used to attach the PDF to outgoing e-mails; in production the route loads
 * the invoice from the database by id instead of receiving it in the body.
 */
export async function POST(req: Request) {
  const { org, customer, doc } = (await req.json()) as { org: Organization; customer?: Customer; doc: DocumentData };
  if (!org || !doc?.lines) return NextResponse.json({ error: 'Ongeldige factuur' }, { status: 400 });
  const buffer = await renderToBuffer(<InvoicePdf org={org} customer={customer} doc={doc} />);
  return new NextResponse(new Uint8Array(buffer), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="Factuur ${doc.number || 'concept'}.pdf"` },
  });
}
