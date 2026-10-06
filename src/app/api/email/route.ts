import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getOrganization } from '@/lib/server/docs';
import { requireMember, serverBackendConfigured } from '@/lib/server/supabase';
import { appUrl, invoicePdf, mailConfigured, quotePdf, sendMail } from '@/lib/server/mailer';
import type { Customer, Invoice, Quote } from '@/lib/types';

export const runtime = 'nodejs';

const Body = z.object({
  organizationId: z.string(),
  to: z.string().email(),
  subject: z.string().min(1).max(300),
  body: z.string().max(20_000),
  action: z.object({ label: z.string().max(80), path: z.string().regex(/^\/[fo]\/[A-Z0-9]+$/) }).optional(),
  /** The invoice or quote as the app has it right now (it may not be saved yet). */
  invoice: z.unknown().optional(),
  quote: z.unknown().optional(),
  customer: z.unknown().optional(),
});

/**
 * Send an invoice, reminder or quote from the app (Resend), with the PDF
 * attached. Only members of the administration can send, and the button can
 * only point to Brenqo's own invoice/quote pages.
 */
export async function POST(req: Request): Promise<Response> {
  if (!mailConfigured()) return NextResponse.json({ error: 'E-mail niet geconfigureerd' }, { status: 501 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Ongeldige e-mail', issues: parsed.error.issues }, { status: 400 });
  const m = parsed.data;
  if (!serverBackendConfigured()) return NextResponse.json({ error: 'Niet geconfigureerd' }, { status: 501 });
  const auth = await requireMember(req, m.organizationId, { write: true });
  if (auth.error) return auth.error;
  const org = await getOrganization(m.organizationId);
  if (!org) return NextResponse.json({ error: 'Administratie niet gevonden' }, { status: 404 });

  const attachments = [];
  const inv = m.invoice as Invoice | undefined;
  const quote = m.quote as Quote | undefined;
  const customer = m.customer as Customer | undefined;
  if (inv && inv.organizationId === org.id) attachments.push(await invoicePdf(org, customer, inv));
  if (quote && quote.organizationId === org.id) attachments.push(await quotePdf(org, customer, quote));

  const result = await sendMail({
    from: org.name,
    replyTo: org.email,
    to: m.to,
    subject: m.subject,
    body: m.body,
    action: m.action ? { label: m.action.label, url: `${appUrl(req)}${m.action.path}` } : undefined,
    attachments,
  });
  return NextResponse.json(result);
}
