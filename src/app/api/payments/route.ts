import { NextResponse } from 'next/server';
import { z } from 'zod';
import { findInvoiceByToken, getMollieKey } from '@/lib/server/docs';
import { serverBackendConfigured } from '@/lib/server/supabase';
import { createPayment, enabledMethods } from '@/lib/server/mollie';
import { appUrl } from '@/lib/server/mailer';
import { amountDue } from '@/lib/domain/calc';

export const runtime = 'nodejs';

/**
 * Start an online payment from the public invoice page. The amount always
 * comes from the database, never from the browser.
 */
export async function POST(req: Request) {
  if (!serverBackendConfigured()) return NextResponse.json({ error: 'Niet geconfigureerd' }, { status: 501 });
  const parsed = z.object({ token: z.string() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Ongeldig verzoek' }, { status: 400 });
  const found = await findInvoiceByToken(parsed.data.token);
  if (!found) return NextResponse.json({ error: 'Factuur niet gevonden' }, { status: 404 });
  const { invoice, org } = found;
  const due = amountDue(invoice);
  if (due <= 0) return NextResponse.json({ error: 'Deze factuur is al betaald' }, { status: 409 });
  const key = await getMollieKey(org.id);
  if (!key || !org.payments.connected) return NextResponse.json({ error: 'Online betalen staat niet aan' }, { status: 501 });
  const base = appUrl(req);
  const payment = await createPayment(key, {
    amount: due,
    description: `Factuur ${invoice.number} ${org.name}`.slice(0, 255),
    redirectUrl: `${base}/f/${invoice.publicToken}?betaald=1`,
    webhookUrl: `${base}/api/webhooks/mollie?org=${encodeURIComponent(org.id)}`,
    methods: enabledMethods(org).filter((m) => m !== 'banktransfer'),
    metadata: { token: invoice.publicToken, invoiceId: invoice.id, organizationId: org.id },
  });
  return NextResponse.json({ checkoutUrl: payment._links?.checkout?.href, paymentId: payment.id });
}
