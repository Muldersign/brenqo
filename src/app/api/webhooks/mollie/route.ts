import { NextResponse } from 'next/server';
import { createStore } from 'zustand/vanilla';
import { getMollieKey, loadOrganizationData, saveChanges } from '@/lib/server/docs';
import { serverBackendConfigured } from '@/lib/server/supabase';
import { getPayment } from '@/lib/server/mollie';
import { notifyOrganization } from '@/lib/server/push';
import { createActions, pickData, type Store } from '@/lib/store/core';
import { formatEUR } from '@/lib/domain/money';

export const runtime = 'nodejs';

/**
 * Mollie calls this with `id=tr_…` when a payment changes. We never trust the
 * body: the payment is fetched from Mollie with this administration's key.
 * Only when it is `paid` and the automation is on, the payment is booked —
 * with the same code the app uses, so status, payment date, notification and
 * stopped reminders all follow. Repeated calls are ignored (idempotent).
 */
export async function POST(req: Request) {
  if (!serverBackendConfigured()) return NextResponse.json({ error: 'Niet geconfigureerd' }, { status: 501 });
  const orgId = new URL(req.url).searchParams.get('org') ?? '';
  const form = await req.formData().catch(() => null);
  const id = String(form?.get('id') ?? '');
  if (!orgId || !/^tr_\w+$/.test(id)) return NextResponse.json({ error: 'Onbekende betaling' }, { status: 400 });
  const key = await getMollieKey(orgId);
  if (!key) return NextResponse.json({ error: 'Geen sleutel' }, { status: 404 });

  const payment = await getPayment(key, id);
  if (payment.status !== 'paid' || payment.metadata?.organizationId !== orgId) return new NextResponse(null, { status: 200 });

  const data = await loadOrganizationData(orgId);
  const org = data.organizations[0];
  const inv = data.invoices.find((i) => i.id === payment.metadata?.invoiceId && i.publicToken === payment.metadata?.token);
  if (!inv || !org.automations.processOnlinePayments) return new NextResponse(null, { status: 200 });

  const store = createStore<Store>()((set, get) => ({ ...data, ...createActions(set, get) }));
  const before = pickData(store.getState());
  const method = payment.method === 'creditcard' ? 'creditcard' : payment.method === 'bancontact' ? 'bancontact' : payment.method === 'banktransfer' ? 'bank' : 'ideal';
  store.getState().registerPayment(inv.id, {
    date: (payment.paidAt ?? new Date().toISOString()).slice(0, 10),
    amount: Number(payment.amount.value),
    method,
    source: 'online',
    providerPaymentId: payment.id,
  });
  await saveChanges(before, pickData(store.getState()));
  await notifyOrganization(orgId, { title: `Factuur ${inv.number} is betaald`, body: `${formatEUR(Number(payment.amount.value))} ontvangen via ${method === 'ideal' ? 'iDEAL' : method}.`, url: `/facturen/${inv.id}` }).catch(() => {});
  return new NextResponse(null, { status: 200 });
}
