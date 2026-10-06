import { findInvoiceByToken } from '@/lib/server/docs';
import { invoicePdf } from '@/lib/server/mailer';
import { serverBackendConfigured } from '@/lib/server/supabase';

export const runtime = 'nodejs';

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  if (!serverBackendConfigured()) return new Response('Niet geconfigureerd', { status: 501 });
  const { token } = await ctx.params;
  const found = await findInvoiceByToken(token);
  if (!found) return new Response('Niet gevonden', { status: 404 });
  const pdf = await invoicePdf(found.org, found.customer, found.invoice);
  return new Response(new Uint8Array(pdf.content), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${encodeURIComponent(pdf.filename)}"`, 'Cache-Control': 'no-store' },
  });
}
