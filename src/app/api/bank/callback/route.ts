import { NextResponse } from 'next/server';
import { accountInfo, getRequisition } from '@/lib/server/bank';
import { adminClient } from '@/lib/server/supabase';
import { putDoc } from '@/lib/server/docs';
import { syncOrganizationBank } from '@/lib/server/bank-sync';
import { appUrl } from '@/lib/server/mailer';
import { uid } from '@/lib/utils';
import type { BankAccount } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** The bank sends the user back here after approving. Store the accounts and fetch transactions. */
export async function GET(req: Request) {
  const base = appUrl(req);
  const ref = new URL(req.url).searchParams.get('ref') ?? '';
  const { data: conn } = await adminClient().from('bank_connections').select('*').eq('reference', ref).maybeSingle();
  if (!conn) return NextResponse.redirect(`${base}/bank/rekeningen?koppeling=mislukt`);
  const requisition = await getRequisition(conn.requisition_id);
  if (requisition.status !== 'LN' || !requisition.accounts.length) {
    await adminClient().from('bank_connections').update({ status: requisition.status }).eq('requisition_id', conn.requisition_id);
    return NextResponse.redirect(`${base}/bank/rekeningen?koppeling=geannuleerd`);
  }
  const { data: existing } = await adminClient().from('bank_accounts').select('data').eq('organization_id', conn.organization_id);
  const known = new Map((existing ?? []).map((r) => [((r.data as BankAccount).iban || '').replace(/\s/g, ''), r.data as BankAccount]));
  const bankName = conn.institution_id.split('_')[0].replace(/^ABNAMRO$/, 'ABN AMRO').replace(/^RABOBANK$/, 'Rabobank');
  for (const accountId of requisition.accounts) {
    const info = await accountInfo(accountId);
    const prev = known.get(info.iban.replace(/\s/g, ''));
    const now = new Date().toISOString();
    const account: BankAccount = {
      ...(prev ?? { id: uid('acc'), organizationId: conn.organization_id, color: '#171717', connectedAt: now }),
      bankName: prev?.bankName ?? bankName.charAt(0) + bankName.slice(1).toLowerCase(),
      name: prev?.name ?? info.name,
      iban: info.iban,
      balance: info.balance,
      provider: 'psd2',
      providerAccountId: accountId,
      lastSyncAt: now,
      consentValidUntil: conn.valid_until,
    };
    await putDoc('bank_accounts', account);
  }
  await adminClient().from('bank_connections').update({ status: 'linked' }).eq('requisition_id', conn.requisition_id);
  await syncOrganizationBank(conn.organization_id).catch(() => {});
  return NextResponse.redirect(`${base}/bank/rekeningen?koppeling=gelukt`);
}
