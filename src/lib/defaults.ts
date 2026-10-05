import type { Organization, ReminderStep } from './types';

export const DEFAULT_INVOICE_EMAIL_SUBJECT = 'Factuur [factuurnummer] van [bedrijf]';
export const DEFAULT_INVOICE_EMAIL_BODY = `Beste [naam],

Hierbij ontvang je factuur [factuurnummer] ter hoogte van [bedrag].

Je kunt de factuur bekijken en betalen via onderstaande knop.

Met vriendelijke groet,

[bedrijf]`;

export const DEFAULT_QUOTE_EMAIL_SUBJECT = 'Offerte [offertenummer] van [bedrijf]';
export const DEFAULT_QUOTE_EMAIL_BODY = `Beste [naam],

Zoals besproken ontvang je hierbij onze offerte [offertenummer] van [bedrag].

Via onderstaande knop kun je de offerte bekijken en direct online accepteren.

Met vriendelijke groet,

[bedrijf]`;

export function defaultReminderSteps(): ReminderStep[] {
  return [
    {
      id: 'r1',
      label: 'Vriendelijke herinnering',
      daysAfterDue: 3,
      enabled: true,
      subject: 'Herinnering factuur [factuurnummer]',
      body: `Beste [naam],

Volgens onze administratie staat factuur [factuurnummer] van [bedrag] nog open.

Het kan natuurlijk zijn dat de betaling en deze herinnering elkaar hebben gekruist.

Via onderstaande knop kun je de factuur bekijken en betalen.

Met vriendelijke groet,
[bedrijf]`,
    },
    {
      id: 'r2',
      label: 'Tweede herinnering',
      daysAfterDue: 10,
      enabled: true,
      subject: 'Tweede herinnering factuur [factuurnummer]',
      body: `Beste [naam],

Eerder stuurden we je een herinnering voor factuur [factuurnummer] van [bedrag]. Helaas hebben we de betaling nog niet ontvangen.

Wil je het bedrag binnen 7 dagen overmaken? Dat kan eenvoudig via onderstaande knop.

Heb je vragen over de factuur? Laat het ons gerust weten.

Met vriendelijke groet,
[bedrijf]`,
    },
    {
      id: 'r3',
      label: 'Laatste herinnering',
      daysAfterDue: 20,
      enabled: true,
      subject: 'Laatste herinnering factuur [factuurnummer]',
      body: `Beste [naam],

Ondanks eerdere herinneringen staat factuur [factuurnummer] van [bedrag] nog altijd open. De vervaldatum was [vervaldatum].

We vragen je het bedrag uiterlijk binnen 5 dagen te voldoen. Lukt dat niet, neem dan even contact met ons op, dan zoeken we samen naar een oplossing.

Met vriendelijke groet,
[bedrijf]`,
    },
  ];
}

export function blankOrganization(id: string, name: string, year: number): Organization {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 12) || 'administratie';
  return {
    id,
    kind: 'business',
    name,
    tradeName: name,
    initials: name.slice(0, 2).toUpperCase(),
    address: '',
    postalCode: '',
    city: '',
    country: 'Nederland',
    kvk: '',
    vatNumber: '',
    vatRegistered: true,
    iban: '',
    bic: '',
    email: '',
    phone: '',
    website: '',
    accentColor: '#5B4BF5',
    invoicePrefix: `${year}-`,
    nextInvoiceNumber: 1,
    quotePrefix: `OF-${year}-`,
    nextQuoteNumber: 1,
    paymentTermDays: 14,
    quoteValidDays: 30,
    defaultVatRate: 21,
    defaultInvoiceNote: 'Bedankt voor de prettige samenwerking.',
    invoiceEmailSubject: DEFAULT_INVOICE_EMAIL_SUBJECT,
    invoiceEmailBody: DEFAULT_INVOICE_EMAIL_BODY,
    quoteEmailSubject: DEFAULT_QUOTE_EMAIL_SUBJECT,
    quoteEmailBody: DEFAULT_QUOTE_EMAIL_BODY,
    inboxAddress: `${slug}-${Math.random().toString(36).slice(2, 6).toUpperCase()}@inbox.brenqo.nl`,
    reminders: { enabled: true, steps: defaultReminderSteps() },
    payments: {
      provider: 'none',
      connected: false,
      payLinkOnInvoice: true,
      payButtonInEmail: true,
      methods: { ideal: true, bancontact: false, creditcard: false, banktransfer: true },
    },
    automations: {
      autoMarkPaidOnBankMatch: true,
      recognizeSuppliers: true,
      sendReminders: true,
      createRecurring: true,
      sendRecurring: false,
      processOnlinePayments: true,
    },
  };
}
