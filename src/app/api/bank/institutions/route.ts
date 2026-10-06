import { NextResponse } from 'next/server';
import { bankProviderConfigured, listInstitutions } from '@/lib/server/bank';
import { requireUser, serverBackendConfigured } from '@/lib/server/supabase';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  if (!serverBackendConfigured() || !bankProviderConfigured()) return NextResponse.json({ error: 'Bankkoppeling niet geconfigureerd' }, { status: 501 });
  const auth = await requireUser(req);
  if (auth.error) return auth.error;
  const list = await listInstitutions('NL');
  return NextResponse.json(list.map((i) => ({ id: i.id, name: i.name, logo: i.logo })), { headers: { 'Cache-Control': 'private, max-age=3600' } });
}
