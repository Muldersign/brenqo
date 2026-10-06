'use client';

import { toast } from 'sonner';
import type { AppData, AppUser, Member } from '../types';
import { useStore } from '../store';
import { pickData, emptyData } from '../store/core';
import { initials } from '../utils';
import { supabase } from './client';
import { diffData } from './diff';
import { ENTITY_KEYS, ENTITY_TABLES } from './tables';

const PAGE = 1000;

async function selectAll<T>(table: string, columns: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase().from(table).select(columns).range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) return out;
  }
}

/** Load everything the signed-in user may see (row level security does the scoping). */
export async function loadAll(user: AppUser, preferredOrgId?: string): Promise<AppData> {
  const [orgs, memberRows, inviteRows, ...entityRows] = await Promise.all([
    selectAll<{ id: string; data: AppData['organizations'][number] }>('organizations', 'id, data'),
    selectAll<{ organization_id: string; user_id: string; role: Member['role']; name: string; email: string }>('organization_members', 'organization_id, user_id, role, name, email'),
    selectAll<{ organization_id: string; email: string; name: string; role: Member['role'] }>('organization_invites', 'organization_id, email, name, role'),
    ...ENTITY_KEYS.map((k) => selectAll<{ data: unknown }>(ENTITY_TABLES[k], 'data')),
  ]);
  const data = emptyData();
  data.user = user;
  data.organizations = orgs.map((o) => ({ ...o.data, id: o.id }));
  data.members = [
    ...memberRows.map((m) => ({ id: `mem_${m.organization_id}_${m.user_id}`, organizationId: m.organization_id, name: m.name || m.email, email: m.email, role: m.role })),
    ...inviteRows.map((i) => ({ id: `inv_${i.organization_id}_${i.email}`, organizationId: i.organization_id, name: i.name || i.email, email: i.email, role: i.role })),
  ];
  ENTITY_KEYS.forEach((k, i) => {
    (data as unknown as Record<string, unknown[]>)[k] = entityRows[i].map((r) => r.data);
  });
  data.activeOrgId = data.organizations.some((o) => o.id === preferredOrgId) ? preferredOrgId! : data.organizations[0]?.id ?? '';
  data.automationsRanOn = undefined;
  return data;
}

let synced: AppData | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;
let unsubscribe: (() => void) | null = null;
let failedOnce = false;

export function hasPendingChanges() {
  return !!timer || flushing;
}

/** Push every change in the store to Supabase (debounced, in order, retried on the next change). */
async function flush() {
  timer = null;
  if (!synced || flushing) return;
  flushing = true;
  const next = pickData(useStore.getState());
  const changes = diffData(synced, next);
  let ok = true;
  for (const c of changes) {
    if (c.upserts.length) {
      const { error } = await supabase().from(c.table).upsert(c.upserts, { onConflict: 'id' });
      if (error) {
        ok = false;
        console.error('Opslaan mislukt', c.table, error);
        toast.error(error.code === '23505' && c.table === 'invoices' ? 'Dit factuurnummer is al gebruikt' : 'Opslaan lukte niet', {
          id: 'sync-error',
          description: error.code === '23505' && c.table === 'invoices' ? 'Op een ander apparaat is net een factuur gemaakt. Ververs de pagina en probeer opnieuw.' : 'We proberen het opnieuw zodra je verbinding hebt.',
        });
        continue;
      }
    }
    if (c.deletes.length) {
      const { error } = await supabase().from(c.table).delete().in('id', c.deletes);
      if (error) { ok = false; console.error('Verwijderen mislukt', c.table, error); continue; }
    }
    (synced as unknown as Record<string, unknown>)[c.key] = (next as unknown as Record<string, unknown>)[c.key];
  }
  // Invitations: new members added in Instellingen → Gebruikers.
  const prevMembers = new Set(synced.members.map((m) => m.id));
  const invites = next.members.filter((m) => !prevMembers.has(m.id) && m.role !== 'owner' && m.email && m.email !== next.user.email);
  if (invites.length) {
    const { error } = await supabase().from('organization_invites').upsert(invites.map((m) => ({ organization_id: m.organizationId, email: m.email.toLowerCase(), name: m.name, role: m.role === 'viewer' ? 'viewer' : 'admin' })));
    if (error) ok = false;
  }
  if (!invites.length || ok) synced.members = next.members;
  synced = { ...synced, user: next.user, activeOrgId: next.activeOrgId };
  flushing = false;
  if (!ok && !failedOnce) { failedOnce = true; schedule(5000); }
  if (ok) failedOnce = false;
  if (ok && diffData(synced, pickData(useStore.getState())).length) schedule();
}

function schedule(delay = 400) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(flush, delay);
}

/** Replace the store with server data and start watching for changes. */
export function startSync(data: AppData) {
  useStore.setState({ ...data });
  synced = pickData(useStore.getState());
  unsubscribe?.();
  unsubscribe = useStore.subscribe(() => schedule());
}

/** Reload from the server (e.g. when the app comes back into view), unless local changes are still pending. */
export async function refresh() {
  if (!synced || hasPendingChanges()) return;
  const s = useStore.getState();
  const data = await loadAll(s.user, s.activeOrgId);
  if (hasPendingChanges()) return;
  startSync(data);
}

export function stopSync() {
  unsubscribe?.();
  unsubscribe = null;
  synced = null;
  if (timer) clearTimeout(timer);
  timer = null;
}

export function userFromSession(u: { id: string; email?: string; user_metadata?: Record<string, unknown> }): AppUser {
  const name = (u.user_metadata?.name as string) || (u.email ?? '').split('@')[0];
  return { id: u.id, name, email: u.email ?? '', initials: initials(name) };
}

export async function signOut() {
  stopSync();
  await supabase().auth.signOut();
  try { localStorage.removeItem('brenqo-data'); } catch { /* ignore */ }
  useStore.setState({ ...emptyData() });
}

/** Upload the original receipt / invoice file; returns its storage path. */
export async function uploadDocument(organizationId: string, file: Blob, fileName: string): Promise<string | undefined> {
  const path = `${organizationId}/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}-${fileName.replace(/[^\w.-]/g, '_')}`;
  const { error } = await supabase().storage.from('documents').upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) {
    console.error('Upload mislukt', error);
    return undefined;
  }
  return path;
}

export async function documentUrl(path: string) {
  const { data } = await supabase().storage.from('documents').createSignedUrl(path, 60 * 10);
  return data?.signedUrl;
}
