import { NextResponse } from 'next/server';
import { extractDocument, ocrConfigured } from '@/lib/server/ocr';
import { createExpenseDraft, findOrganizationByInbox, repositoryConfigured, storeDocument } from '@/lib/server/repository';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface InboundPayload {
  To?: string;
  ToFull?: { Email: string }[];
  From?: string;
  Subject?: string;
  Attachments?: { Name: string; Content: string; ContentType: string; ContentLength?: number }[];
}

/**
 * Inbound e-mail webhook (Postmark inbound JSON format; Resend/SendGrid are
 * similar). Mail sent to `<administratie>-XXXX@inbox.brenqo.nl` lands here:
 * find the administration by address → take PDF/image attachments → store
 * them → read them with OCR → create a draft purchase invoice ("Even
 * controleren") → notify the user.
 * Protect this route with the provider's basic-auth or signature (INBOUND_SECRET).
 */
export async function POST(req: Request) {
  if (!repositoryConfigured()) return NextResponse.json({ error: 'Niet geconfigureerd' }, { status: 501 });
  const secret = process.env.INBOUND_SECRET;
  if (secret && req.headers.get('authorization') !== `Basic ${Buffer.from(`brenqo:${secret}`).toString('base64')}`) {
    return NextResponse.json({ error: 'Niet toegestaan' }, { status: 401 });
  }
  const mail = (await req.json()) as InboundPayload;
  const recipients = [...(mail.ToFull?.map((t) => t.Email) ?? []), ...(mail.To?.split(',') ?? [])].map((s) => s.trim().toLowerCase());
  let org: Awaited<ReturnType<typeof findOrganizationByInbox>> = null;
  for (const r of recipients) {
    org = await findOrganizationByInbox(r.replace(/^.*</, '').replace(/>$/, ''));
    if (org) break;
  }
  if (!org) return NextResponse.json({ ok: true, skipped: 'unknown recipient' });

  const attachments = (mail.Attachments ?? []).filter((a) => /pdf|image\//.test(a.ContentType));
  let created = 0;
  for (const a of attachments) {
    const bytes = Buffer.from(a.Content, 'base64');
    const path = await storeDocument(org.id, a.Name, bytes, a.ContentType);
    const fields = ocrConfigured() ? await extractDocument(bytes, a.ContentType, 'invoice') : null;
    await createExpenseDraft(org.id, fields ? {
      supplier_name: fields.supplierName, invoice_number: fields.invoiceNumber, date: fields.date || new Date().toISOString().slice(0, 10),
      due_date: fields.dueDate || null, subtotal: fields.subtotal, vat_amount: fields.vatAmount, total: fields.total, vat_rate: fields.vatRate,
      iban: fields.iban, description: fields.description, category: fields.categoryHint,
    } : { supplier_name: mail.From ?? 'Onbekend', date: new Date().toISOString().slice(0, 10), total: 0, subtotal: 0, vat_amount: 0, vat_rate: 21, category: 'Overig', description: mail.Subject ?? '' }, { path, fileName: a.Name, mimeType: a.ContentType });
    created++;
  }
  return NextResponse.json({ ok: true, created });
}
