import { NextResponse } from 'next/server';
import { findInvoiceByToken, recordOnlinePayment, repositoryConfigured } from '@/lib/server/repository';

export const runtime = 'nodejs';

/**
 * Mollie calls this with `id=tr_…` whenever a payment changes. We never trust
 * the body: we fetch the payment from Mollie ourselves, and only when it is
 * `paid` we store the payment — which flips the invoice to "Betaald", saves the
 * payment date, stops reminders and creates a notification (see the
 * record_invoice_payment function in the database).
 */
export async function POST(req: Request) {
  const key = process.env.MOLLIE_API_KEY;
  if (!key || !repositoryConfigured()) return NextResponse.json({ error: 'Niet geconfigureerd' }, { status: 501 });
  const form = await req.formData();
  const id = String(form.get('id') ?? '');
  if (!/^tr_\w+$/.test(id)) return NextResponse.json({ error: 'Onbekende betaling' }, { status: 400 });

  const res = await fetch(`https://api.mollie.com/v2/payments/${id}`, { headers: { Authorization: `Bearer ${key}` } });
  if (!res.ok) return NextResponse.json({ error: 'Betaling niet gevonden' }, { status: 404 });
  const payment = await res.json();
  if (payment.status !== 'paid') return new NextResponse(null, { status: 200 });

  const invoice = await findInvoiceByToken(payment.metadata?.token ?? '');
  if (!invoice) return new NextResponse(null, { status: 200 });

  await recordOnlinePayment({
    invoiceId: invoice.id,
    organizationId: invoice.organization_id,
    amount: Number(payment.amount.value),
    paidAt: (payment.paidAt ?? new Date().toISOString()).slice(0, 10),
    providerPaymentId: payment.id,
    method: payment.method ?? 'ideal',
  });
  // Mollie only needs a 200; anything else makes it retry.
  return new NextResponse(null, { status: 200 });
}
