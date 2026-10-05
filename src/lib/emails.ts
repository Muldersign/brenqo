import type { Customer, Invoice, Organization } from './types';
import { fillTemplate } from './domain/template';
import { formatDocNumber } from './domain/numbering';
import { invoiceTotal } from './domain/calc';
import { formatEUR } from './domain/money';
import { formatDateLong } from './domain/dates';

/** Default e-mail for an invoice, with the administration's own template. */
export function invoiceEmail(org: Organization, customer: Customer | undefined, inv: Invoice) {
  const number = inv.number || formatDocNumber(org.invoicePrefix, org.nextInvoiceNumber);
  const vars = {
    naam: customer?.contactName || customer?.companyName || '',
    factuurnummer: number,
    bedrag: formatEUR(invoiceTotal(inv)),
    bedrijf: org.name,
    vervaldatum: formatDateLong(inv.dueDate),
  };
  return { to: customer?.email ?? '', subject: fillTemplate(org.invoiceEmailSubject, vars), body: fillTemplate(org.invoiceEmailBody, vars) };
}
