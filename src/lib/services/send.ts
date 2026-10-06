'use client';

import { useStore } from '../store';
import { amountDue, documentTotals, invoiceTotal } from '../domain/calc';
import { formatEUR } from '../domain/money';
import { deliverEmail } from './email';

type Mail = { to: string; subject: string; body: string };

/**
 * Send an invoice: assign its number first (so the PDF carries it), deliver
 * the e-mail with PDF and pay button, and only then record it as sent.
 */
export async function sendInvoiceNow(invoiceId: string, mail: Mail) {
  useStore.getState().finalizeInvoice(invoiceId);
  const s = useStore.getState();
  const inv = s.invoices.find((x) => x.id === invoiceId)!;
  const org = s.organizations.find((o) => o.id === inv.organizationId)!;
  const customer = s.customers.find((c) => c.id === inv.customerId);
  const total = invoiceTotal(inv);
  const result = await deliverEmail({
    organizationId: org.id, ...mail, invoice: inv, customer,
    action: { label: org.payments.payButtonInEmail ? `Bekijk en betaal ${formatEUR(total)}` : 'Bekijk factuur', path: `/f/${inv.publicToken}` },
  });
  if (result.delivered) useStore.getState().sendInvoice(invoiceId, mail);
  return { ...result, number: inv.number };
}

export async function sendReminderNow(invoiceId: string, mail: Mail) {
  const s = useStore.getState();
  const inv = s.invoices.find((x) => x.id === invoiceId)!;
  const customer = s.customers.find((c) => c.id === inv.customerId);
  const result = await deliverEmail({
    organizationId: inv.organizationId, ...mail, invoice: inv, customer,
    action: { label: `Betaal ${formatEUR(amountDue(inv))}`, path: `/f/${inv.publicToken}` },
  });
  if (result.delivered) useStore.getState().sendReminder(invoiceId, mail);
  return result;
}

export async function sendQuoteNow(quoteId: string, mail: Mail) {
  const s = useStore.getState();
  const quote = s.quotes.find((x) => x.id === quoteId)!;
  const customer = s.customers.find((c) => c.id === quote.customerId);
  const result = await deliverEmail({
    organizationId: quote.organizationId, ...mail, quote, customer,
    action: { label: `Bekijk offerte (${formatEUR(documentTotals(quote.lines).total)})`, path: `/o/${quote.publicToken}` },
  });
  if (result.delivered) useStore.getState().sendQuote(quoteId, mail);
  return result;
}
