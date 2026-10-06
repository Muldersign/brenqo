import { NextResponse } from 'next/server';
import { findQuoteByToken, putDoc } from '@/lib/server/docs';
import { serverBackendConfigured } from '@/lib/server/supabase';
import { publicQuoteView } from '@/lib/server/public-view';
import { notifyOrganization } from '@/lib/server/push';
import { uid } from '@/lib/utils';

export const runtime = 'nodejs';

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  if (!serverBackendConfigured()) return NextResponse.json({ error: 'Niet geconfigureerd' }, { status: 501 });
  const { token } = await ctx.params;
  const found = await findQuoteByToken(token);
  if (!found) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 });
  return NextResponse.json(publicQuoteView(found), { headers: { 'Cache-Control': 'no-store' } });
}

/** `{"accepted": true|false}` — the customer accepts or declines online. */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  if (!serverBackendConfigured()) return NextResponse.json({ error: 'Niet geconfigureerd' }, { status: 501 });
  const { token } = await ctx.params;
  const { accepted } = (await req.json().catch(() => ({}))) as { accepted?: boolean };
  if (typeof accepted !== 'boolean') return NextResponse.json({ error: 'Ongeldig' }, { status: 400 });
  const found = await findQuoteByToken(token);
  if (!found) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 });
  const q = found.quote;
  if (q.state !== 'sent') return NextResponse.json({ error: 'Op deze offerte is al gereageerd' }, { status: 409 });
  await putDoc('quotes', { ...q, state: accepted ? 'accepted' : 'declined', respondedAt: new Date().toISOString() });
  const title = `Offerte ${q.number} is ${accepted ? 'geaccepteerd' : 'afgewezen'}.`;
  await putDoc('notifications', {
    id: uid('ntf'), organizationId: q.organizationId, kind: 'quote', title,
    body: `${found.customer?.companyName ?? 'De klant'} heeft de offerte online ${accepted ? 'geaccepteerd' : 'afgewezen'}.`,
    href: `/offertes/${q.id}`, createdAt: new Date().toISOString(), read: false,
  } as { id: string; organizationId: string });
  await notifyOrganization(q.organizationId, { title, url: `/offertes/${q.id}` }).catch(() => {});
  return NextResponse.json({ ok: true });
}
