import 'server-only';
import { createStore } from 'zustand/vanilla';
import { createActions, pickData, type Store } from '../store/core';
import { addDays, todayISO } from '../domain/dates';
import { adminClient } from './supabase';
import { loadOrganizationData, saveChanges } from './docs';
import { accountInfo, bankProviderConfigured, fetchTransactions } from './bank';

/** Fetch new transactions for every PSD2-connected account of one administration and match them. */
export async function syncOrganizationBank(organizationId: string) {
  if (!bankProviderConfigured()) return { added: 0, matched: 0 };
  const data = await loadOrganizationData(organizationId);
  const store = createStore<Store>()((set, get) => ({ ...data, ...createActions(set, get) }));
  const before = pickData(store.getState());
  let added = 0;
  let matched = 0;
  for (const acc of data.bankAccounts.filter((a) => a.provider === 'psd2' && a.providerAccountId)) {
    const since = acc.lastImportDate ? addDays(acc.lastImportDate, -5) : addDays(todayISO(), -90);
    const [txs, info] = await Promise.all([fetchTransactions(acc.providerAccountId!, since), accountInfo(acc.providerAccountId!)]);
    const r = store.getState().importTransactions(acc.id, txs);
    added += r.added;
    matched += r.matched;
    store.setState((s) => ({ bankAccounts: s.bankAccounts.map((a) => (a.id === acc.id ? { ...a, balance: info.balance, lastSyncAt: new Date().toISOString() } : a)) }));
  }
  await saveChanges(before, pickData(store.getState()));
  return { added, matched };
}

export async function syncAllBankAccounts() {
  if (!bankProviderConfigured()) return { skipped: 'Geen bankkoppeling geconfigureerd' };
  const { data } = await adminClient().from('bank_accounts').select('organization_id').eq('data->>provider', 'psd2');
  const orgs = [...new Set((data ?? []).map((r) => r.organization_id as string))];
  const out: Record<string, unknown> = {};
  for (const id of orgs) {
    out[id] = await syncOrganizationBank(id).catch((e) => ({ error: String(e) }));
  }
  return out;
}
