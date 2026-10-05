/**
 * Brenqo datamodel. Every record that belongs to an administration carries
 * `organizationId`; the Supabase schema mirrors this (see supabase/migrations)
 * and row level security enforces the separation server-side.
 */

export type ID = string;
/** ISO date, `YYYY-MM-DD`. */
export type ISODate = string;
/** ISO timestamp. */
export type ISODateTime = string;

export type VatRate = 0 | 9 | 21;

export interface ReminderStep {
  id: string;
  label: string;
  daysAfterDue: number;
  enabled: boolean;
  subject: string;
  body: string;
}

export interface Organization {
  id: ID;
  kind: 'business' | 'association';
  name: string;
  tradeName: string;
  initials: string;
  logoDataUrl?: string;
  address: string;
  postalCode: string;
  city: string;
  country: string;
  kvk: string;
  vatNumber: string;
  vatRegistered: boolean;
  iban: string;
  bic: string;
  email: string;
  phone: string;
  website: string;
  accentColor: string;
  invoicePrefix: string;
  nextInvoiceNumber: number;
  quotePrefix: string;
  nextQuoteNumber: number;
  paymentTermDays: number;
  quoteValidDays: number;
  defaultVatRate: VatRate;
  defaultInvoiceNote: string;
  invoiceEmailSubject: string;
  invoiceEmailBody: string;
  quoteEmailSubject: string;
  quoteEmailBody: string;
  inboxAddress: string;
  reminders: { enabled: boolean; steps: ReminderStep[] };
  payments: {
    provider: 'mollie' | 'none';
    connected: boolean;
    payLinkOnInvoice: boolean;
    payButtonInEmail: boolean;
    methods: { ideal: boolean; bancontact: boolean; creditcard: boolean; banktransfer: boolean };
  };
  automations: {
    autoMarkPaidOnBankMatch: boolean;
    recognizeSuppliers: boolean;
    sendReminders: boolean;
    createRecurring: boolean;
    sendRecurring: boolean;
    processOnlinePayments: boolean;
  };
}

export interface Customer {
  id: ID;
  organizationId: ID;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  postalCode: string;
  city: string;
  country: string;
  kvk: string;
  vatNumber: string;
  iban: string;
  paymentTermDays: number;
  defaultInvoiceText: string;
  remindersEnabled: boolean;
  /** Free labels, e.g. "Lid" or "Sponsor" for an association. */
  tags: string[];
  createdAt: ISODateTime;
}

export interface Supplier {
  id: ID;
  organizationId: ID;
  name: string;
  /** Learned from earlier choices ("Adobe wordt normaal geboekt als Software"). */
  defaultCategory: string;
  defaultVatRate: VatRate;
  iban: string;
  email: string;
  website: string;
  timesUsed: number;
}

export interface Product {
  id: ID;
  organizationId: ID;
  name: string;
  description: string;
  price: number;
  vatRate: VatRate;
  unit: string;
}

export interface DocumentLine {
  id: ID;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  vatRate: VatRate;
  /** Percentage discount on this line, 0–100. */
  discountPct: number;
  productId?: ID;
}

export type PaymentMethod = 'ideal' | 'bank' | 'bancontact' | 'creditcard' | 'cash' | 'other';

export interface InvoicePayment {
  id: ID;
  date: ISODate;
  amount: number;
  method: PaymentMethod;
  note: string;
  source: 'manual' | 'bank' | 'online';
  transactionId?: ID;
}

/**
 * Stored lifecycle state. What the user sees ("Verlopen", "Openstaand") is
 * derived from this plus dates and payments — see domain/status.ts.
 */
export type InvoiceState = 'draft' | 'open' | 'sent' | 'viewed' | 'paid' | 'partial' | 'credited';

export interface Invoice {
  id: ID;
  organizationId: ID;
  kind: 'invoice' | 'credit';
  number: string;
  customerId: ID;
  issueDate: ISODate;
  dueDate: ISODate;
  reference: string;
  lines: DocumentLine[];
  note: string;
  state: InvoiceState;
  payments: InvoicePayment[];
  publicToken: string;
  sentAt?: ISODateTime;
  viewedAt?: ISODateTime;
  paidAt?: ISODate;
  creditOfId?: ID;
  creditedById?: ID;
  quoteId?: ID;
  recurringId?: ID;
  remindersEnabled: boolean;
  remindersSent: { stepId: string; sentAt: ISODateTime }[];
  createdAt: ISODateTime;
}

export type QuoteState = 'draft' | 'sent' | 'accepted' | 'declined';

export interface Quote {
  id: ID;
  organizationId: ID;
  number: string;
  customerId: ID;
  issueDate: ISODate;
  validUntil: ISODate;
  reference: string;
  lines: DocumentLine[];
  note: string;
  state: QuoteState;
  publicToken: string;
  sentAt?: ISODateTime;
  respondedAt?: ISODateTime;
  invoiceId?: ID;
  createdAt: ISODateTime;
}

export interface Category {
  id: ID;
  organizationId: ID;
  name: string;
  icon: string;
  custom: boolean;
}

export interface Expense {
  id: ID;
  organizationId: ID;
  kind: 'receipt' | 'invoice';
  supplierName: string;
  supplierId?: ID;
  invoiceNumber: string;
  date: ISODate;
  dueDate?: ISODate;
  subtotal: number;
  vatAmount: number;
  total: number;
  vatRate: VatRate;
  category: string;
  description: string;
  iban: string;
  /** `review`: read by OCR but not yet checked by the user. */
  status: 'review' | 'processed';
  paid: boolean;
  source: 'camera' | 'upload' | 'email';
  document: { fileName: string; mimeType: string; previewDataUrl?: string };
  transactionId?: ID;
  createdAt: ISODateTime;
}

export interface BankAccount {
  id: ID;
  organizationId: ID;
  bankName: string;
  name: string;
  iban: string;
  balance: number;
  provider: 'demo' | 'psd2';
  connectedAt: ISODateTime;
  lastSyncAt: ISODateTime;
  consentValidUntil: ISODate;
  color: string;
}

export type TransactionStatus = 'todo' | 'suggested' | 'matched' | 'categorized' | 'ignored';

export interface BankTransaction {
  id: ID;
  organizationId: ID;
  accountId: ID;
  date: ISODate;
  description: string;
  counterparty: string;
  counterpartyIban: string;
  amount: number;
  status: TransactionStatus;
  invoiceId?: ID;
  expenseId?: ID;
  category?: string;
  /** 0–100, how sure the matcher is about `invoiceId`/`expenseId`. */
  confidence?: number;
  autoMatched?: boolean;
}

export type Frequency = 'monthly' | 'quarterly' | 'yearly';

export interface RecurringInvoice {
  id: ID;
  organizationId: ID;
  name: string;
  customerId: ID;
  lines: DocumentLine[];
  frequency: Frequency;
  startDate: ISODate;
  nextDate: ISODate;
  endDate?: ISODate;
  autoCreate: boolean;
  autoSend: boolean;
  active: boolean;
  invoiceIds: ID[];
}

export type NotificationKind = 'paid' | 'overdue' | 'expense' | 'receipt' | 'bank' | 'quote' | 'recurring' | 'info';

export interface AppNotification {
  id: ID;
  organizationId: ID;
  kind: NotificationKind;
  title: string;
  body?: string;
  href?: string;
  createdAt: ISODateTime;
  read: boolean;
}

export interface EmailLog {
  id: ID;
  organizationId: ID;
  kind: 'invoice' | 'reminder' | 'quote';
  invoiceId?: ID;
  quoteId?: ID;
  to: string;
  subject: string;
  body: string;
  sentAt: ISODateTime;
}

export interface AppUser {
  id: ID;
  name: string;
  email: string;
  initials: string;
}

export interface Member {
  id: ID;
  organizationId: ID;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'viewer';
}

/** Everything Brenqo stores. In production each array is a Postgres table. */
export interface AppData {
  user: AppUser;
  activeOrgId: ID;
  organizations: Organization[];
  members: Member[];
  customers: Customer[];
  suppliers: Supplier[];
  products: Product[];
  invoices: Invoice[];
  quotes: Quote[];
  categories: Category[];
  expenses: Expense[];
  bankAccounts: BankAccount[];
  transactions: BankTransaction[];
  recurring: RecurringInvoice[];
  notifications: AppNotification[];
  emailLogs: EmailLog[];
  /** Last day the background automations ran (reminders, recurring invoices). */
  automationsRanOn?: ISODate;
}
