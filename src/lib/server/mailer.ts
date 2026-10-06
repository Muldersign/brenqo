import 'server-only';
import { renderToBuffer } from '@react-pdf/renderer';
import type { Customer, Invoice, Organization, Quote } from '../types';
import { InvoicePdf } from '../pdf/invoice-pdf';
import { invoiceToDocData, quoteToDocData } from '../pdf/doc-data';
import { amountDue } from '../domain/calc';
import { formatEUR } from '../domain/money';

export function mailConfigured() {
  return !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export function appUrl(req?: Request) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  if (req) return new URL(req.url).origin;
  return 'http://localhost:3000';
}

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function renderHtml(body: string, action?: { label: string; url: string }) {
  const paragraphs = escape(body).split(/\n{2,}/).map((p) => `<p style="margin:0 0 16px">${p.replace(/\n/g, '<br>')}</p>`).join('');
  const button = action
    ? `<p style="margin:28px 0"><a href="${escape(action.url)}" style="background:#0a0a0a;color:#fafafa;text-decoration:none;padding:11px 20px;border-radius:999px;font-weight:500;display:inline-block">${escape(action.label)}</a></p>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:#f5f5f5;padding:32px 16px;font-family:Geist,-apple-system,Segoe UI,Inter,sans-serif;color:#0a0a0a;font-size:15px;line-height:1.6"><div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e5e5;border-radius:24px;padding:32px">${paragraphs}${button}</div></body></html>`;
}

export async function sendMail(mail: { from: string; to: string; replyTo?: string; subject: string; body: string; action?: { label: string; url: string }; attachments?: { filename: string; content: Buffer }[] }) {
  if (!mailConfigured()) throw new Error('E-mail is niet geconfigureerd');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `${mail.from.replace(/[<>"]/g, '')} <${process.env.EMAIL_FROM}>`,
      to: [mail.to],
      reply_to: mail.replyTo || undefined,
      subject: mail.subject,
      text: `${mail.body}${mail.action ? `\n\n${mail.action.label}: ${mail.action.url}` : ''}`,
      html: renderHtml(mail.body, mail.action),
      attachments: mail.attachments?.map((a) => ({ filename: a.filename, content: a.content.toString('base64') })),
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  return (await res.json()) as { id: string };
}

export async function invoicePdf(org: Organization, customer: Customer | undefined, inv: Invoice) {
  const buf = await renderToBuffer(InvoicePdf({ org, customer, doc: invoiceToDocData(inv) }));
  return { filename: `${inv.kind === 'credit' ? 'Creditfactuur' : 'Factuur'} ${inv.number} - ${org.name}.pdf`, content: Buffer.from(buf) };
}

export async function quotePdf(org: Organization, customer: Customer | undefined, q: Quote) {
  const buf = await renderToBuffer(InvoicePdf({ org, customer, doc: quoteToDocData(q) }));
  return { filename: `Offerte ${q.number} - ${org.name}.pdf`, content: Buffer.from(buf) };
}

/** Send an invoice or reminder e-mail with the PDF and the pay button. */
export async function sendInvoiceMail(base: string, org: Organization, customer: Customer | undefined, inv: Invoice, mail: { to: string; subject: string; body: string }) {
  const due = amountDue(inv);
  return sendMail({
    from: org.name,
    replyTo: org.email,
    to: mail.to,
    subject: mail.subject,
    body: mail.body,
    action: { label: org.payments.payButtonInEmail && due > 0 ? `Bekijk en betaal ${formatEUR(due)}` : 'Bekijk factuur', url: `${base}/f/${inv.publicToken}` },
    attachments: [await invoicePdf(org, customer, inv)],
  });
}
