import 'server-only';
import type { AppData, Customer, Invoice, Organization, Quote } from '../types';
import { emptyData } from '../store/core';
import { diffData } from '../backend/diff';
import { ENTITY_KEYS, ENTITY_TABLES } from '../backend/tables';
import { adminClient } from './supabase';

/** Server access to the JSON documents (see supabase/migrations). Always scoped on organization_id. */

export async function getOrganization(id: string): Promise<Organization | null> {
  const { data } = await adminClient().from('organizations').select('data').eq('id', id).maybeSingle();
  return (data?.data as Organization) ?? null;
}

export async function listOrganizationIds(): Promise<string[]> {
  const { data, error } = await adminClient().from('organizations').select('id');
  if (error) throw error;
  return (data ?? []).map((r) => r.id as string);
}

export async function getDoc<T>(table: string, organizationId: string, id: string): Promise<T | null> {
  const { data } = await adminClient().from(table).select('data').eq('organization_id', organizationId).eq('id', id).maybeSingle();
  return (data?.data as T) ?? null;
}

export async function putDoc<T extends { id: string; organizationId: string }>(table: string, doc: T) {
  const { error } = await adminClient().from(table).upsert({ id: doc.id, organization_id: doc.organizationId, data: doc }, { onConflict: 'id' });
  if (error) throw error;
}

export async function findInvoiceByToken(token: string): Promise<{ invoice: Invoice; org: Organization; customer?: Customer } | null> {
  if (!/^[A-Z0-9]{6,32}$/.test(token)) return null;
  const { data } = await adminClient().from('invoices').select('organization_id, data').eq('public_token', token).maybeSingle();
  if (!data) return null;
  const invoice = data.data as Invoice;
  if (invoice.state === 'draft') return null;
  const [org, customer] = await Promise.all([getOrganization(data.organization_id), getDoc<Customer>('customers', data.organization_id, invoice.customerId)]);
  return org ? { invoice, org, customer: customer ?? undefined } : null;
}

export async function findQuoteByToken(token: string): Promise<{ quote: Quote; org: Organization; customer?: Customer } | null> {
  if (!/^[A-Z0-9]{6,32}$/.test(token)) return null;
  const { data } = await adminClient().from('quotes').select('organization_id, data').eq('public_token', token).maybeSingle();
  if (!data) return null;
  const quote = data.data as Quote;
  if (quote.state === 'draft') return null;
  const [org, customer] = await Promise.all([getOrganization(data.organization_id), getDoc<Customer>('customers', data.organization_id, quote.customerId)]);
  return org ? { quote, org, customer: customer ?? undefined } : null;
}

/** Everything of one administration, in the shape of the app store. */
export async function loadOrganizationData(organizationId: string): Promise<AppData> {
  const db = adminClient();
  const data = emptyData();
  const org = await getOrganization(organizationId);
  if (!org) throw new Error(`Administratie ${organizationId} bestaat niet`);
  data.organizations = [org];
  data.activeOrgId = organizationId;
  await Promise.all(
    ENTITY_KEYS.map(async (k) => {
      const rows: unknown[] = [];
      for (let from = 0; ; from += 1000) {
        const { data: page, error } = await db.from(ENTITY_TABLES[k]).select('data').eq('organization_id', organizationId).range(from, from + 999);
        if (error) throw error;
        rows.push(...(page ?? []).map((r) => r.data));
        if (!page || page.length < 1000) break;
      }
      (data as unknown as Record<string, unknown[]>)[k] = rows;
    }),
  );
  return data;
}

/** Write the difference between two snapshots of one administration. */
export async function saveChanges(before: AppData, after: AppData) {
  const db = adminClient();
  for (const c of diffData(before, after)) {
    if (c.upserts.length) {
      const { error } = await db.from(c.table).upsert(c.upserts, { onConflict: 'id' });
      if (error) throw error;
    }
    if (c.deletes.length) {
      const { error } = await db.from(c.table).delete().in('id', c.deletes);
      if (error) throw error;
    }
  }
}

export async function getMollieKey(organizationId: string): Promise<string | null> {
  const { data } = await adminClient().from('organization_secrets').select('mollie_api_key').eq('organization_id', organizationId).maybeSingle();
  return (data?.mollie_api_key as string) || process.env.MOLLIE_API_KEY || null;
}

export async function setMollieKey(organizationId: string, key: string | null) {
  const { error } = await adminClient().from('organization_secrets').upsert({ organization_id: organizationId, mollie_api_key: key, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function storeDocument(organizationId: string, fileName: string, bytes: Buffer, mimeType: string) {
  const path = `${organizationId}/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}-${fileName.replace(/[^\w.-]/g, '_')}`;
  const { error } = await adminClient().storage.from('documents').upload(path, bytes, { contentType: mimeType });
  if (error) throw error;
  return path;
}
