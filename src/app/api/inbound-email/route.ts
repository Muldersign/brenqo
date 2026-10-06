import { NextResponse } from 'next/server';
import { extractDocument, ocrConfigured } from '@/lib/server/ocr';
import { getOrganization, putDoc, storeDocument } from '@/lib/server/docs';
import { adminClient, serverBackendConfigured } from '@/lib/server/supabase';
import { notifyOrganization } from '@/lib/server/push';
import { guessCategory } from '@/lib/domain/categories';
import { splitVat } from '@/lib/domain/calc';
import { todayISO } from '@/lib/domain/dates';
import { uid } from '@/lib/utils';
import type { Expense, Supplier } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface InboundPayload {
  To?: string;
  ToFull?: { Email: string }[];
  From?: string;
  FromName?: string;
  Subject?: string;
  Attachments?: { Name: string; Content: string; ContentType: string }[];
}

/**
 * Inbound e-mail webhook (Postmark inbound JSON). Mail to the administration's
 * own address (Instellingen → E-mail) becomes a purchase invoice in
 * "Even controleren": attachment stored, read by OCR, supplier recognised.
 * Protect with basic auth: https://brenqo:<INBOUND_SECRET>@app.../api/inbound-email
 */
export async function POST(req: Request) {
  if (!serverBackendConfigured()) return NextResponse.json({ error: 'Niet geconfigureerd' }, { status: 501 });
  const secret = process.env.INBOUND_SECRET;
  if (!secret || req.headers.get('authorization') !== `Basic ${Buffer.from(`brenqo:${secret}`).toString('base64')}`) {
    return NextResponse.json({ error: 'Niet toegestaan' }, { status: 401 });
  }
  const mail = (await req.json()) as InboundPayload;
  const recipients = [...(mail.ToFull?.map((t) => t.Email) ?? []), ...(mail.To?.split(',') ?? [])].map((s) => s.trim().replace(/^.*</, '').replace(/>$/, '').toLowerCase());
  let orgId: string | null = null;
  for (const r of recipients) {
    const { data } = await adminClient().from('organizations').select('id').eq('inbox_address', r).maybeSingle();
    if (data) { orgId = data.id; break; }
  }
  if (!orgId) return NextResponse.json({ ok: true, skipped: 'onbekend adres' });
  const org = await getOrganization(orgId);
  const { data: supRows } = await adminClient().from('suppliers').select('data').eq('organization_id', orgId);
  const suppliers = (supRows ?? []).map((r) => r.data as Supplier);

  let created = 0;
  for (const a of (mail.Attachments ?? []).filter((x) => /pdf|image\/(jpe?g|png|webp)/.test(x.ContentType))) {
    const bytes = Buffer.from(a.Content, 'base64');
    const storagePath = await storeDocument(orgId, a.Name, bytes, a.ContentType);
    const fields = ocrConfigured() ? await extractDocument(bytes, a.ContentType, 'invoice').catch(() => null) : null;
    const supplierName = fields?.supplierName || mail.FromName || mail.From || 'Onbekende leverancier';
    const guess = guessCategory(supplierName, suppliers, org?.automations.recognizeSuppliers ?? true);
    const total = fields?.total ?? 0;
    const vatRate = guess.source === 'memory' ? guess.vatRate : fields?.vatRate ?? 21;
    const split = splitVat(total, vatRate);
    const expense: Expense = {
      id: uid('exp'), organizationId: orgId, kind: 'invoice', supplierName, supplierId: guess.supplierId,
      invoiceNumber: fields?.invoiceNumber ?? '', date: fields?.date || todayISO(), dueDate: fields?.dueDate || undefined,
      subtotal: fields?.subtotal ?? split.base, vatAmount: fields?.vatAmount ?? split.vat, total, vatRate,
      category: guess.source === 'memory' ? guess.category : fields?.categoryHint || guess.category,
      description: fields?.description || mail.Subject || '', iban: fields?.iban ?? '', status: 'review', paid: false, source: 'email',
      document: { fileName: a.Name, mimeType: a.ContentType, storagePath }, createdAt: new Date().toISOString(),
    };
    await putDoc('expenses', expense);
    const title = `Nieuwe inkoopfactuur van ${supplierName} ontvangen.`;
    await putDoc('notifications', { id: uid('ntf'), organizationId: orgId, kind: 'expense', title, body: 'Uitgelezen en klaar om te controleren.', href: '/inkoopfacturen', createdAt: new Date().toISOString(), read: false });
    await notifyOrganization(orgId, { title, url: '/inkoopfacturen' }).catch(() => {});
    created++;
  }
  return NextResponse.json({ ok: true, created });
}
