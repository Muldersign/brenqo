import { NextResponse } from 'next/server';
import { z } from 'zod';
import { bankProviderConfigured } from '@/lib/server/bank';
import { requireMember, serverBackendConfigured } from '@/lib/server/supabase';
import { syncOrganizationBank } from '@/lib/server/bank-sync';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** "Ophalen" in the app: fetch new transactions now. */
export async function POST(req: Request) {
  if (!serverBackendConfigured() || !bankProviderConfigured()) return NextResponse.json({ error: 'Bankkoppeling niet geconfigureerd' }, { status: 501 });
  const parsed = z.object({ organizationId: z.string() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Ongeldig verzoek' }, { status: 400 });
  const auth = await requireMember(req, parsed.data.organizationId, { write: true });
  if (auth.error) return auth.error;
  return NextResponse.json(await syncOrganizationBank(parsed.data.organizationId));
}
