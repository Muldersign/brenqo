import { NextResponse } from 'next/server';
import { listOrganizationIds } from '@/lib/server/docs';
import { serverBackendConfigured } from '@/lib/server/supabase';
import { runOrganizationAutomations } from '@/lib/server/automations';
import { syncAllBankAccounts } from '@/lib/server/bank-sync';
import { appUrl } from '@/lib/server/mailer';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Daily job (Vercel Cron, see vercel.json): fetch bank transactions, then per
 * administration create recurring invoices, send due reminders and match
 * payments. Protected with CRON_SECRET (Vercel sends it as a bearer token).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Niet toegestaan' }, { status: 401 });
  if (!serverBackendConfigured()) return NextResponse.json({ error: 'Niet geconfigureerd' }, { status: 501 });
  const base = appUrl(req);
  const bank = await syncAllBankAccounts().catch((e: unknown) => ({ error: String(e) }));
  const results: Record<string, unknown> = {};
  for (const id of await listOrganizationIds()) {
    try {
      results[id] = await runOrganizationAutomations(id, base);
    } catch (e) {
      results[id] = { error: e instanceof Error ? e.message : String(e) };
    }
  }
  return NextResponse.json({ ok: true, bank, results });
}
