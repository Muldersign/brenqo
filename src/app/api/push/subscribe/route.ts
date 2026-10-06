import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminClient, requireUser, serverBackendConfigured } from '@/lib/server/supabase';

export const runtime = 'nodejs';

const Sub = z.object({ endpoint: z.string().url(), keys: z.object({ p256dh: z.string(), auth: z.string() }) });

/** Register this device for push notifications ("Factuur 2026-034 is betaald"). */
export async function POST(req: Request) {
  if (!serverBackendConfigured()) return NextResponse.json({ error: 'Niet geconfigureerd' }, { status: 501 });
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  const parsed = Sub.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Ongeldig abonnement' }, { status: 400 });
  const { error } = await adminClient().from('push_subscriptions').upsert({ endpoint: parsed.data.endpoint, user_id: auth.user.id, subscription: parsed.data });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!serverBackendConfigured()) return NextResponse.json({ error: 'Niet geconfigureerd' }, { status: 501 });
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  const { endpoint } = (await req.json().catch(() => ({}))) as { endpoint?: string };
  if (endpoint) await adminClient().from('push_subscriptions').delete().eq('endpoint', endpoint).eq('user_id', auth.user.id);
  return NextResponse.json({ ok: true });
}
