import { NextResponse } from 'next/server';
import { findInvoiceByToken, putDoc } from '@/lib/server/docs';
import { serverBackendConfigured } from '@/lib/server/supabase';
import { publicInvoiceView } from '@/lib/server/public-view';

export const runtime = 'nodejs';

/** The customer's view of an invoice: only what is printed on the invoice itself. */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  if (!serverBackendConfigured()) return NextResponse.json({ error: 'Niet geconfigureerd' }, { status: 501 });
  const { token } = await ctx.params;
  const found = await findInvoiceByToken(token);
  if (!found) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 });
  return NextResponse.json(publicInvoiceView(found), { headers: { 'Cache-Control': 'no-store' } });
}

/** `{"event":"viewed"}` — the customer opened the invoice (status "Bekeken"). */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  if (!serverBackendConfigured()) return NextResponse.json({ error: 'Niet geconfigureerd' }, { status: 501 });
  const { token } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { event?: string };
  if (body.event !== 'viewed') return NextResponse.json({ error: 'Onbekend' }, { status: 400 });
  const found = await findInvoiceByToken(token);
  if (!found) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 });
  const inv = found.invoice;
  if (!inv.viewedAt) {
    await putDoc('invoices', { ...inv, viewedAt: new Date().toISOString(), state: inv.state === 'sent' || inv.state === 'open' ? 'viewed' : inv.state });
  }
  return NextResponse.json({ ok: true });
}
