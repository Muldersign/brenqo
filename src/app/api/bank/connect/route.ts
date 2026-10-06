import { NextResponse } from 'next/server';
import { z } from 'zod';
import { bankProviderConfigured, createConsent } from '@/lib/server/bank';
import { adminClient, requireMember, serverBackendConfigured } from '@/lib/server/supabase';
import { appUrl } from '@/lib/server/mailer';
import { addDays, todayISO } from '@/lib/domain/dates';

export const runtime = 'nodejs';

/** Start a PSD2 consent: returns the bank's page where the user approves read access. */
export async function POST(req: Request) {
  if (!serverBackendConfigured() || !bankProviderConfigured()) return NextResponse.json({ error: 'Bankkoppeling niet geconfigureerd' }, { status: 501 });
  const parsed = z.object({ organizationId: z.string(), institutionId: z.string() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Ongeldig verzoek' }, { status: 400 });
  const auth = await requireMember(req, parsed.data.organizationId, { write: true });
  if (auth.error) return auth.error;
  const reference = `${parsed.data.organizationId}.${crypto.randomUUID()}`;
  const consent = await createConsent({ institutionId: parsed.data.institutionId, redirectUrl: `${appUrl(req)}/api/bank/callback`, reference });
  const { error } = await adminClient().from('bank_connections').insert({
    requisition_id: consent.requisitionId, organization_id: parsed.data.organizationId, reference, institution_id: parsed.data.institutionId,
    valid_until: addDays(todayISO(), consent.validDays),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ link: consent.link });
}
