'use client';

import type { Customer, Invoice, Quote } from '../types';
import { authedFetch } from '../backend/client';

export interface OutgoingEmail {
  organizationId: string;
  to: string;
  subject: string;
  body: string;
  /** Rendered as a button under the message: a Brenqo page such as `/f/<token>`. */
  action?: { label: string; path: string };
  /** Attached as PDF. */
  invoice?: Invoice;
  quote?: Quote;
  customer?: Customer;
}

/**
 * Deliver an e-mail through `/api/email` (Resend, with the PDF attached).
 * Without e-mail configured the route answers 501 and we treat it as a demo:
 * the message still lands in the administration's e-mail log.
 */
export async function deliverEmail(mail: OutgoingEmail): Promise<{ delivered: boolean; demo: boolean; error?: string }> {
  if (process.env.NEXT_PUBLIC_STANDALONE_DEMO === '1') return { delivered: true, demo: true };
  try {
    const res = await authedFetch('/api/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(mail) });
    if (res.status === 501) return { delivered: true, demo: true };
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      return { delivered: false, demo: false, error: (j as { error?: string }).error ?? `Fout ${res.status}` };
    }
    return { delivered: true, demo: false };
  } catch (e) {
    return { delivered: false, demo: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function publicUrl(path: string) {
  if (typeof window === 'undefined') return path;
  return `${window.location.origin}${path}`;
}
