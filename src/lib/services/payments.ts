'use client';

import type { Invoice } from '../types';
import { amountDue } from '../domain/calc';

/**
 * Start an online payment for an invoice. With `MOLLIE_API_KEY` configured,
 * `/api/payments` creates a Mollie payment and we redirect to its checkout;
 * Mollie later calls `/api/webhooks/mollie`, which marks the invoice paid.
 * Without a key we use the built-in demo checkout so the flow can be tried.
 */
export async function startPayment(inv: Invoice, returnUrl: string): Promise<string> {
  if ((process.env.NODE_ENV as string) === 'demo') return `/f/${inv.publicToken}/betalen`;
  try {
    const res = await fetch('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceId: inv.id, token: inv.publicToken, amount: amountDue(inv), description: `Factuur ${inv.number}`, redirectUrl: `${returnUrl}?betaald=1` }),
    });
    if (res.ok) {
      const { checkoutUrl } = await res.json();
      if (checkoutUrl) return checkoutUrl;
    }
  } catch {
    /* fall back to demo checkout */
  }
  return `/f/${inv.publicToken}/betalen`;
}
