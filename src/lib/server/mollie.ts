import 'server-only';
import type { Organization } from '../types';

const API = 'https://api.mollie.com/v2';

export interface MolliePayment {
  id: string;
  status: 'open' | 'canceled' | 'pending' | 'authorized' | 'expired' | 'failed' | 'paid';
  amount: { value: string; currency: string };
  method: string | null;
  paidAt?: string;
  metadata?: { token?: string; invoiceId?: string; organizationId?: string };
  _links?: { checkout?: { href: string } };
}

async function call<T>(key: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...init.headers } });
  if (!res.ok) throw new Error(`Mollie ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export function enabledMethods(org: Organization): string[] {
  const m = org.payments.methods;
  return [m.ideal && 'ideal', m.bancontact && 'bancontact', m.creditcard && 'creditcard', m.banktransfer && 'banktransfer'].filter(Boolean) as string[];
}

export function createPayment(key: string, input: { amount: number; description: string; redirectUrl: string; webhookUrl: string; methods: string[]; metadata: Record<string, string> }) {
  return call<MolliePayment>(key, '/payments', {
    method: 'POST',
    body: JSON.stringify({
      amount: { currency: 'EUR', value: input.amount.toFixed(2) },
      description: input.description,
      redirectUrl: input.redirectUrl,
      webhookUrl: input.webhookUrl,
      method: input.methods.length ? input.methods : undefined,
      locale: 'nl_NL',
      metadata: input.metadata,
    }),
  });
}

export function getPayment(key: string, id: string) {
  return call<MolliePayment>(key, `/payments/${encodeURIComponent(id)}`);
}

/** Checks that a key works (used when the user saves it in Instellingen). */
export async function verifyKey(key: string) {
  if (!/^(test|live)_[A-Za-z0-9]{20,}$/.test(key)) return false;
  try {
    await call(key, '/methods');
    return true;
  } catch {
    return false;
  }
}
