'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Customer, Invoice, Organization, Quote } from '../types';
import { backendEnabled } from '../backend/config';
import { useStore } from '../store';

type State<T> = { status: 'loading' } | { status: 'missing' } | ({ status: 'ready' } & T);

/**
 * The customer's view of an invoice. With accounts switched on it comes from
 * the server (works on any device); in the demo it comes from this browser.
 */
export function usePublicInvoice(token: string, opts: { waitForPayment?: boolean } = {}) {
  // Separate selectors: each returns a stable reference (an object literal here would re-render forever).
  const localInvoice = useStore((s) => s.invoices.find((i) => i.publicToken === token && i.state !== 'draft'));
  const localOrg = useStore((s) => s.organizations.find((o) => o.id === localInvoice?.organizationId));
  const localCustomer = useStore((s) => s.customers.find((c) => c.id === localInvoice?.customerId));
  const [remote, setRemote] = useState<State<{ invoice: Invoice; org: Organization; customer?: Customer }>>({ status: 'loading' });

  const load = useCallback(async () => {
    const res = await fetch(`/api/public/invoice/${token}`, { cache: 'no-store' });
    if (!res.ok) { setRemote({ status: 'missing' }); return null; }
    const data = await res.json();
    setRemote({ status: 'ready', ...data });
    return data as { invoice: Invoice };
  }, [token]);

  useEffect(() => {
    if (!backendEnabled) return;
    let cancelled = false;
    (async () => {
      const data = await load();
      if (cancelled || !data) return;
      if (!data.invoice.viewedAt) fetch(`/api/public/invoice/${token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"event":"viewed"}' }).catch(() => {});
      // Just paid via Mollie: the webhook may land a moment later.
      if (opts.waitForPayment && data.invoice.state !== 'paid') {
        for (let i = 0; i < 6 && !cancelled; i++) {
          await new Promise((r) => setTimeout(r, 2500));
          const next = await load();
          if (next?.invoice.state === 'paid') break;
        }
      }
    })();
    return () => { cancelled = true; };
  }, [load, token, opts.waitForPayment]);

  if (!backendEnabled) {
    return localInvoice && localOrg ? ({ status: 'ready', invoice: localInvoice, org: localOrg, customer: localCustomer } as const) : ({ status: 'missing' } as const);
  }
  return remote;
}

export function usePublicQuote(token: string) {
  const localQuote = useStore((s) => s.quotes.find((q) => q.publicToken === token && q.state !== 'draft'));
  const localOrg = useStore((s) => s.organizations.find((o) => o.id === localQuote?.organizationId));
  const localCustomer = useStore((s) => s.customers.find((c) => c.id === localQuote?.customerId));
  const respondLocal = useStore((s) => s.respondToQuote);
  const [remote, setRemote] = useState<State<{ quote: Quote; org: Organization; customer?: Customer }>>({ status: 'loading' });

  const load = useCallback(async () => {
    const res = await fetch(`/api/public/quote/${token}`, { cache: 'no-store' });
    setRemote(res.ok ? { status: 'ready', ...(await res.json()) } : { status: 'missing' });
  }, [token]);

  useEffect(() => { if (backendEnabled) load(); }, [load]);

  const respond = useCallback(async (accepted: boolean) => {
    if (!backendEnabled) { respondLocal(token, accepted); return true; }
    const res = await fetch(`/api/public/quote/${token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accepted }) });
    await load();
    return res.ok;
  }, [load, respondLocal, token]);

  const state = !backendEnabled
    ? (localQuote && localOrg ? ({ status: 'ready', quote: localQuote, org: localOrg, customer: localCustomer } as const) : ({ status: 'missing' } as const))
    : remote;
  return { state, respond };
}
