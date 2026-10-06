/**
 * End-to-end: the real Supabase client against a real Postgres with the real
 * migration and row level security (PostgREST in between), started by
 * supabase/tests/stack.mjs. Run with: npm run test:e2e
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { createStore } from 'zustand/vanilla';
import type { AppData } from '@/lib/types';

let stack: ChildProcess;
let env: { url: string; anonKey: string; serviceKey: string; users: { id: string; email: string; name: string; token: string }[] };

beforeAll(async () => {
  stack = spawn('node', ['supabase/tests/stack.mjs'], { stdio: ['ignore', 'pipe', 'inherit'] });
  env = await new Promise((resolve, reject) => {
    stack.stdout!.once('data', (d) => { try { resolve(JSON.parse(String(d))); } catch (e) { reject(e); } });
    stack.once('exit', (c) => reject(new Error(`stack exited ${c}`)));
  });
  await new Promise((r) => setTimeout(r, 1200)); // PostgREST schema cache
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', env.url);
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', env.anonKey);
  vi.stubEnv('SUPABASE_URL', env.url);
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', env.serviceKey);
  vi.stubEnv('APP_URL', 'https://app.brenqo.test');
});

afterAll(() => { stack?.kill('SIGTERM'); vi.unstubAllEnvs(); });

const userClient = (i: number) => createClient(env.url, env.anonKey, { global: { headers: { Authorization: `Bearer ${env.users[i].token}` } }, auth: { persistSession: false } });

describe('Brenqo backend', () => {
  it('syncs the app store to the database and back (signed-in user)', async () => {
    const { supabase } = await import('@/lib/backend/client');
    await supabase().auth.setSession({ access_token: env.users[0].token, refresh_token: 'x' });
    const { loadAll, startSync, hasPendingChanges, userFromSession, stopSync } = await import('@/lib/backend/sync');
    const { useStore } = await import('@/lib/store');

    const glenn = env.users[0];
    const empty = await loadAll(userFromSession({ id: glenn.id, email: glenn.email, user_metadata: { name: glenn.name } }));
    expect(empty.organizations).toEqual([]);
    startSync(empty);

    const s = useStore.getState();
    const orgId = s.createOrganization({ name: 'Muldersign', kind: 'business' });
    useStore.getState().updateOrganization({ iban: 'NL00INGB0123456789', email: 'hallo@muldersign.nl' });
    const customerId = useStore.getState().saveCustomer({ companyName: 'De Leo Media', email: 'leo@deleomedia.nl', iban: 'NL20RABO0312345678' });
    const invoiceId = useStore.getState().saveInvoice({ customerId, lines: [{ id: 'l1', description: 'Website onderhoud', quantity: 2, unit: 'uur', unitPrice: 75, vatRate: 21, discountPct: 0 }] });
    useStore.getState().sendInvoice(invoiceId, { to: 'leo@deleomedia.nl', subject: 'Factuur', body: 'Hoi' });
    await vi.waitFor(() => expect(hasPendingChanges()).toBe(false), { timeout: 5000, interval: 100 });
    await new Promise((r) => setTimeout(r, 600));

    // A fresh load (another device) gets exactly the same data.
    const reloaded = await loadAll(useStore.getState().user);
    expect(reloaded.organizations.map((o) => o.id)).toEqual([orgId]);
    expect(reloaded.customers.map((c) => c.companyName)).toEqual(['De Leo Media']);
    const inv = reloaded.invoices.find((i) => i.id === invoiceId)!;
    expect(inv).toMatchObject({ number: `${new Date().getFullYear()}-001`, state: 'sent' });
    expect(reloaded.categories.length).toBeGreaterThan(10);
    expect(reloaded.members).toEqual([expect.objectContaining({ email: glenn.email, role: 'owner' })]);

    // Deleting a draft removes the row.
    const draft = useStore.getState().saveInvoice({ customerId, lines: [] });
    await vi.waitFor(() => expect(hasPendingChanges()).toBe(false), { timeout: 5000, interval: 100 });
    useStore.getState().deleteInvoices([draft]);
    await new Promise((r) => setTimeout(r, 800));
    expect((await loadAll(useStore.getState().user)).invoices.map((i) => i.id)).toEqual([invoiceId]);
    stopSync();
  });

  it('keeps administrations separated between users', async () => {
    const femke = userClient(1);
    const { data: orgs } = await femke.from('organizations').select('id');
    expect(orgs).toEqual([]);
    const { data: invoices } = await femke.from('invoices').select('id');
    expect(invoices).toEqual([]);
    const { error } = await femke.from('customers').insert({ id: 'cus_evil', organization_id: (await userClient(0).from('organizations').select('id')).data![0].id, data: {} });
    expect(error).toBeTruthy();
  });

  it('serves the public invoice without the private fields, and marks it viewed', async () => {
    const { data } = await userClient(0).from('invoices').select('data').limit(1).single();
    const token = (data!.data as { publicToken: string }).publicToken;
    const route = await import('@/app/api/public/invoice/[token]/route');
    const res = await route.GET(new Request('http://x'), { params: Promise.resolve({ token }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.invoice.number).toMatch(/-001$/);
    expect(body.org.inboxAddress).toBe('');
    expect(body.customer.email).toBe('');
    expect(body.customer.iban).toBe('');
    await route.POST(new Request('http://x', { method: 'POST', body: '{"event":"viewed"}' }), { params: Promise.resolve({ token }) });
    const again = await (await route.GET(new Request('http://x'), { params: Promise.resolve({ token }) })).json();
    expect(again.invoice.state).toBe('viewed');
    const missing = await route.GET(new Request('http://x'), { params: Promise.resolve({ token: 'NOPE1234' }) });
    expect(missing.status).toBe(404);
  });

  it('books a Mollie payment exactly once via the webhook', async () => {
    const { data } = await userClient(0).from('invoices').select('organization_id, data').limit(1).single();
    const inv = data!.data as { id: string; publicToken: string; number: string };
    const orgId = data!.organization_id as string;
    const { setMollieKey } = await import('@/lib/server/docs');
    await setMollieKey(orgId, 'test_abcdefghijklmnopqrstuvwxyz12');
    // Online payments must be switched on for this administration.
    const admin = createClient(env.url, env.serviceKey, { auth: { persistSession: false } });
    const { data: org } = await admin.from('organizations').select('data').eq('id', orgId).single();
    await admin.from('organizations').update({ data: { ...(org!.data as object), payments: { ...(org!.data as { payments: object }).payments, connected: true } } }).eq('id', orgId);

    const realFetch = globalThis.fetch;
    const mollie = vi.fn(async () => new Response(JSON.stringify({
      id: 'tr_test123', status: 'paid', amount: { value: '181.50', currency: 'EUR' }, method: 'ideal', paidAt: '2026-10-06T10:00:00+00:00',
      metadata: { token: inv.publicToken, invoiceId: inv.id, organizationId: orgId },
    }), { status: 200 }));
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => (String(input).startsWith('https://api.mollie.com') ? mollie() : realFetch(input, init))) as typeof fetch;
    try {
      const hook = await import('@/app/api/webhooks/mollie/route');
      const call = () => hook.POST(new Request(`http://x/api/webhooks/mollie?org=${orgId}`, { method: 'POST', body: new URLSearchParams({ id: 'tr_test123' }) }));
      expect((await call()).status).toBe(200);
      expect((await call()).status).toBe(200); // Mollie retries; must not double-book
    } finally {
      globalThis.fetch = realFetch;
    }
    const { data: after } = await userClient(0).from('invoices').select('data').eq('id', inv.id).single();
    const paid = after!.data as { state: string; payments: unknown[]; paidAt: string };
    expect(paid.state).toBe('paid');
    expect(paid.payments).toHaveLength(1);
    expect(paid.paidAt).toBe('2026-10-06');
    const { data: notes } = await userClient(0).from('notifications').select('data');
    expect(notes!.map((n) => (n.data as { title: string }).title)).toContain(`Factuur ${inv.number} is betaald.`);
  });

  it('accepts a quote online only once', async () => {
    const admin = createClient(env.url, env.serviceKey, { auth: { persistSession: false } });
    const { data: org } = await admin.from('organizations').select('id').limit(1).single();
    const quote = { id: 'quo_e2e', organizationId: org!.id, number: 'OF-1', customerId: 'x', issueDate: '2026-10-01', validUntil: '2099-01-01', reference: '', lines: [], note: '', state: 'sent', publicToken: 'QUOTETOKEN1', createdAt: '' };
    await admin.from('quotes').insert({ id: quote.id, organization_id: quote.organizationId, data: quote });
    const route = await import('@/app/api/public/quote/[token]/route');
    const post = (accepted: boolean) => route.POST(new Request('http://x', { method: 'POST', body: JSON.stringify({ accepted }) }), { params: Promise.resolve({ token: 'QUOTETOKEN1' }) });
    expect((await post(true)).status).toBe(200);
    expect((await post(false)).status).toBe(409);
  });

  it('runs the daily automations on the server and persists the result', async () => {
    const admin = createClient(env.url, env.serviceKey, { auth: { persistSession: false } });
    const { data: org } = await admin.from('organizations').select('id, data').limit(1).single();
    const { data: cust } = await admin.from('customers').select('id').eq('organization_id', org!.id).limit(1).single();
    const today = new Date().toISOString().slice(0, 10);
    const rec = { id: 'rec_e2e', organizationId: org!.id, name: 'Hosting', customerId: cust!.id, lines: [{ id: 'l', description: 'Hosting', quantity: 1, unit: 'maand', unitPrice: 25, vatRate: 21, discountPct: 0 }], frequency: 'monthly', startDate: today, nextDate: today, autoCreate: true, autoSend: false, active: true, invoiceIds: [] };
    await admin.from('recurring_invoices').insert({ id: rec.id, organization_id: rec.organizationId, data: rec });

    const cron = await import('@/app/api/cron/daily/route');
    expect((await cron.GET(new Request('http://x', { headers: { authorization: 'Bearer wrong' } }))).status).toBe(401);
    vi.stubEnv('CRON_SECRET', 'cron-secret');
    const res = await cron.GET(new Request('http://x', { headers: { authorization: 'Bearer cron-secret' } }));
    const body = await res.json();
    expect(body.results[org!.id]).toMatchObject({ recurring: 1 });
    const { data: recAfter } = await admin.from('recurring_invoices').select('data').eq('id', rec.id).single();
    expect((recAfter!.data as { invoiceIds: string[]; nextDate: string }).invoiceIds).toHaveLength(1);
    expect((recAfter!.data as { nextDate: string }).nextDate > today).toBe(true);
    const { data: invs } = await admin.from('invoices').select('number').eq('organization_id', org!.id);
    expect(invs!.map((i) => i.number).sort()).toEqual([`${today.slice(0, 4)}-001`, `${today.slice(0, 4)}-002`]);
  });

  it('turns an e-mailed PDF into a purchase invoice to check', async () => {
    vi.stubEnv('INBOUND_SECRET', 'inbound-secret');
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    const admin = createClient(env.url, env.serviceKey, { auth: { persistSession: false } });
    const { data: org } = await admin.from('organizations').select('id, inbox_address').limit(1).single();
    const route = await import('@/app/api/inbound-email/route');
    const payload = {
      From: 'facturen@cloud86.nl', FromName: 'Cloud86', To: `Brenqo <${org!.inbox_address.toUpperCase()}>`, Subject: 'Je factuur van oktober',
      Attachments: [{ Name: 'Cloud86-factuur.pdf', ContentType: 'application/pdf', Content: Buffer.from('%PDF-1.4 test').toString('base64') }],
    };
    const post = (auth?: string) => route.POST(new Request('http://x', { method: 'POST', headers: auth ? { authorization: auth } : {}, body: JSON.stringify(payload) }));
    expect((await post()).status).toBe(401);
    const res = await post(`Basic ${Buffer.from('brenqo:inbound-secret').toString('base64')}`);
    expect(await res.json()).toMatchObject({ ok: true, created: 1 });
    const { data: exps } = await userClient(0).from('expenses').select('data');
    const e = exps!.map((x) => x.data as { supplierName: string; status: string; category: string; document: { storagePath?: string } }).find((x) => x.supplierName === 'Cloud86')!;
    expect(e).toMatchObject({ status: 'review', category: 'Hosting' });
    expect(e.document.storagePath).toMatch(new RegExp(`^${org!.id}/`));
  });

  it('refuses e-mail and Mollie settings from non-members', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test');
    vi.stubEnv('EMAIL_FROM', 'facturen@brenqo.test');
    const admin = createClient(env.url, env.serviceKey, { auth: { persistSession: false } });
    const { data: org } = await admin.from('organizations').select('id').limit(1).single();
    const email = await import('@/app/api/email/route');
    const send = (token?: string) => email.POST(new Request('http://x', {
      method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {},
      body: JSON.stringify({ organizationId: org!.id, to: 'a@b.nl', subject: 'x', body: 'y' }),
    }));
    expect((await send()).status).toBe(401);
    expect((await send(env.users[1].token)).status).toBe(403);
    const mollie = await import('@/app/api/settings/mollie/route');
    const res = await mollie.POST(new Request('http://x', { method: 'POST', headers: { authorization: `Bearer ${env.users[1].token}` }, body: JSON.stringify({ organizationId: org!.id, apiKey: null }) }));
    expect(res.status).toBe(403);
  });
});

export type { AppData };
void createStore;
