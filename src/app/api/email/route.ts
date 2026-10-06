import { NextResponse } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';

const Email = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(300),
  body: z.string().max(20_000),
  fromName: z.string().optional(),
  replyTo: z.string().email().optional().or(z.literal('')),
  action: z.object({ label: z.string(), url: z.string().url() }).optional(),
  attachments: z.array(z.object({ filename: z.string(), contentBase64: z.string() })).optional(),
});

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function html(mail: z.infer<typeof Email>) {
  const paragraphs = escape(mail.body).split(/\n{2,}/).map((p) => `<p style="margin:0 0 16px">${p.replace(/\n/g, '<br>')}</p>`).join('');
  const button = mail.action
    ? `<p style="margin:28px 0"><a href="${escape(mail.action.url)}" style="background:#0a0a0a;color:#fafafa;text-decoration:none;padding:11px 20px;border-radius:999px;font-weight:600;display:inline-block">${escape(mail.action.label)}</a></p>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:#f5f5f5;padding:32px 16px;font-family:Geist,-apple-system,Segoe UI,Inter,sans-serif;color:#0a0a0a;font-size:15px;line-height:1.6"><div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e5e5;border-radius:24px;padding:32px">${paragraphs}${button}</div></body></html>`;
}

/**
 * Send a transactional e-mail via Resend (RESEND_API_KEY + EMAIL_FROM).
 * 501 when not configured: the client treats that as "demo, logged only".
 */
export async function POST(req: Request) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) return NextResponse.json({ error: 'E-mail niet geconfigureerd' }, { status: 501 });
  const parsed = Email.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Ongeldige e-mail', issues: parsed.error.issues }, { status: 400 });
  const mail = parsed.data;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: mail.fromName ? `${mail.fromName} <${from}>` : from,
      to: [mail.to],
      reply_to: mail.replyTo || undefined,
      subject: mail.subject,
      text: `${mail.body}${mail.action ? `\n\n${mail.action.label}: ${mail.action.url}` : ''}`,
      html: html(mail),
      attachments: mail.attachments?.map((a) => ({ filename: a.filename, content: a.contentBase64 })),
    }),
  });
  if (!res.ok) return NextResponse.json({ error: 'Versturen mislukt', detail: await res.text() }, { status: 502 });
  return NextResponse.json(await res.json());
}
