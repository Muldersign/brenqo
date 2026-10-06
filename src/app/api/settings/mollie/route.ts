import { NextResponse } from 'next/server';
import { z } from 'zod';
import { setMollieKey } from '@/lib/server/docs';
import { requireMember, serverBackendConfigured } from '@/lib/server/supabase';
import { verifyKey } from '@/lib/server/mollie';

export const runtime = 'nodejs';

/** Save this administration's own Mollie API key (server-side only; never sent back to the browser). */
export async function POST(req: Request): Promise<Response> {
  if (!serverBackendConfigured()) return NextResponse.json({ error: 'Niet geconfigureerd' }, { status: 501 });
  const parsed = z.object({ organizationId: z.string(), apiKey: z.string().nullable() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Ongeldig verzoek' }, { status: 400 });
  const { organizationId, apiKey } = parsed.data;
  const auth = await requireMember(req, organizationId, { write: true });
  if (auth.error) return auth.error;
  if (apiKey && !(await verifyKey(apiKey.trim()))) {
    return NextResponse.json({ error: 'Deze sleutel werkt niet. Kopieer hem opnieuw uit je Mollie-dashboard (Ontwikkelaars → API-sleutels).' }, { status: 422 });
  }
  await setMollieKey(organizationId, apiKey?.trim() || null);
  return NextResponse.json({ ok: true, connected: !!apiKey, mode: apiKey?.startsWith('test_') ? 'test' : apiKey ? 'live' : null });
}
