import 'server-only';
import type { Customer, Invoice, Organization, Quote } from '../types';

/** Organization fields that appear on an invoice anyway; nothing else leaves the server. */
export function publicOrg(org: Organization): Organization {
  return {
    ...org,
    inboxAddress: '',
    invoiceEmailBody: '', invoiceEmailSubject: '', quoteEmailBody: '', quoteEmailSubject: '',
    reminders: { enabled: false, steps: [] },
    automations: { autoMarkPaidOnBankMatch: false, recognizeSuppliers: false, sendReminders: false, createRecurring: false, sendRecurring: false, processOnlinePayments: false },
  };
}

function publicCustomer(c?: Customer): Customer | undefined {
  if (!c) return undefined;
  return { ...c, email: '', phone: '', iban: '', defaultInvoiceText: '', tags: [] };
}

export function publicInvoiceView(x: { invoice: Invoice; org: Organization; customer?: Customer }) {
  const inv = x.invoice;
  return {
    invoice: { ...inv, remindersSent: [], payments: inv.payments.map((p) => ({ ...p, note: '', transactionId: undefined })) },
    org: publicOrg(x.org),
    customer: publicCustomer(x.customer),
  };
}

export function publicQuoteView(x: { quote: Quote; org: Organization; customer?: Customer }) {
  return { quote: x.quote, org: publicOrg(x.org), customer: publicCustomer(x.customer) };
}
