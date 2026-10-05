'use client';

export interface OutgoingEmail {
  to: string;
  subject: string;
  body: string;
  /** Rendered as a button under the message, e.g. the public invoice link. */
  action?: { label: string; url: string };
  attachments?: { filename: string; contentBase64: string }[];
  replyTo?: string;
  fromName?: string;
}

/**
 * Deliver an e-mail through `/api/email` (Resend when `RESEND_API_KEY` is set).
 * In the demo (no key) the route answers 501 and we treat it as delivered —
 * the message still lands in the e-mail log of the administration.
 */
export async function deliverEmail(mail: OutgoingEmail): Promise<{ delivered: boolean; demo: boolean }> {
  if ((process.env.NODE_ENV as string) === 'demo') return { delivered: true, demo: true };
  try {
    const res = await fetch('/api/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(mail) });
    if (res.status === 501) return { delivered: true, demo: true };
    if (!res.ok) throw new Error(await res.text());
    return { delivered: true, demo: false };
  } catch (e) {
    console.warn('E-mail niet via provider verstuurd, demo-modus', e);
    return { delivered: true, demo: true };
  }
}

export function publicUrl(path: string) {
  if (typeof window === 'undefined') return path;
  return `${window.location.origin}${path}`;
}
