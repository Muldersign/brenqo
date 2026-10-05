import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-side data access for things that happen without a logged-in user:
 * payment webhooks and inbound e-mail. Uses the service role key, so every
 * query here MUST scope on organization_id explicitly (RLS is bypassed).
 */
let client: SupabaseClient | null = null;

export function repositoryConfigured() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function db() {
  if (!client) client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  return client;
}

export async function findInvoiceByToken(token: string) {
  const { data, error } = await db().from('invoices').select('id, organization_id, number, state').eq('public_token', token).maybeSingle();
  if (error) throw error;
  return data;
}

/** Idempotent: a payment with the same provider id is only stored once. */
export async function recordOnlinePayment(input: { invoiceId: string; organizationId: string; amount: number; paidAt: string; providerPaymentId: string; method: string }) {
  const { error } = await db().rpc('record_invoice_payment', {
    p_invoice_id: input.invoiceId,
    p_organization_id: input.organizationId,
    p_amount: input.amount,
    p_paid_at: input.paidAt,
    p_method: input.method,
    p_source: 'online',
    p_provider_payment_id: input.providerPaymentId,
  });
  if (error) throw error;
}

export async function findOrganizationByInbox(address: string) {
  const { data, error } = await db().from('organizations').select('id, name').eq('inbox_address', address.toLowerCase()).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createExpenseDraft(organizationId: string, fields: Record<string, unknown>, document: { path: string; fileName: string; mimeType: string }) {
  const { data: doc, error: docError } = await db().from('documents').insert({ organization_id: organizationId, storage_path: document.path, file_name: document.fileName, mime_type: document.mimeType }).select('id').single();
  if (docError) throw docError;
  const { error } = await db().from('expenses').insert({ organization_id: organizationId, kind: 'invoice', status: 'review', source: 'email', document_id: doc.id, ...fields });
  if (error) throw error;
  await db().from('notifications').insert({ organization_id: organizationId, kind: 'expense', title: `Nieuwe inkoopfactuur van ${String(fields.supplier_name ?? 'onbekend')} ontvangen.`, href: '/inkoopfacturen' });
}

export async function storeDocument(organizationId: string, fileName: string, bytes: Buffer, mimeType: string) {
  const path = `${organizationId}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${fileName.replace(/[^\w.-]/g, '_')}`;
  const { error } = await db().storage.from('documents').upload(path, bytes, { contentType: mimeType });
  if (error) throw error;
  return path;
}
