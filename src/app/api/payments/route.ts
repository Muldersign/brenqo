import { NextResponse } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';

const Body = z.object({
  invoiceId: z.string(),
  token: z.string(),
  amount: z.number().positive(),
  description: z.string(),
  redirectUrl: z.string().url(),
});

/**
 * Create a Mollie payment for an invoice and return its checkout URL.
 * Requires MOLLIE_API_KEY and a public APP_URL (for the webhook).
 * 501 when not configured → the client falls back to the demo checkout.
 */
export async function POST(req: Request) {
  const key = process.env.MOLLIE_API_KEY;
  const appUrl = process.env.APP_URL;
  if (!key || !appUrl) return NextResponse.json({ error: 'Betalingen niet geconfigureerd' }, { status: 501 });
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Ongeldig verzoek' }, { status: 400 });
  const { amount, description, redirectUrl, token, invoiceId } = parsed.data;
  // Production: look the amount up server-side by token instead of trusting the client.
  const res = await fetch('https://api.mollie.com/v2/payments', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: { currency: 'EUR', value: amount.toFixed(2) },
      description,
      redirectUrl,
      webhookUrl: `${appUrl}/api/webhooks/mollie`,
      metadata: { invoiceId, token },
    }),
  });
  if (!res.ok) return NextResponse.json({ error: 'Betaling aanmaken mislukt', detail: await res.text() }, { status: 502 });
  const payment = await res.json();
  return NextResponse.json({ checkoutUrl: payment._links?.checkout?.href, paymentId: payment.id });
}
