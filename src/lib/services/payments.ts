'use client';

import type { Invoice } from '../types';

/**
 * Start an online payment for an invoice. With accounts and Mollie set up,
 * `/api/payments` creates the payment (amount taken from the database) and we
 * go to Mollie's checkout; Mollie then calls our webhook, which marks the
 * invoice paid. Otherwise the built-in demo checkout is used.
 */
export async function startPayment(inv: Pick<Invoice, 'publicToken'>): Promise<{ url: string } | { error: string }> {
  if (process.env.NEXT_PUBLIC_STANDALONE_DEMO !== '1') {
    try {
      const res = await fetch('/api/payments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: inv.publicToken }) });
      if (res.ok) {
        const { checkoutUrl } = await res.json();
        if (checkoutUrl) return { url: checkoutUrl };
      } else if (res.status !== 501) {
        const j = await res.json().catch(() => ({}));
        return { error: (j as { error?: string }).error ?? 'Betalen lukt nu even niet' };
      }
    } catch {
      /* fall back to the demo checkout */
    }
  }
  return { url: `/f/${inv.publicToken}/betalen` };
}
