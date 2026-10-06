/**
 * Brenqo store core: all business actions, framework-free. Used by the React
 * store in the browser (./index.ts) and by server jobs (daily automations),
 * so reminders, recurring invoices and bank matching behave identically.
 */
import type {
  AppData, AppNotification, BankTransaction, Customer, DocumentLine, EmailLog, Expense, ID, Invoice, InvoicePayment,
  Organization, Product, Quote, RecurringInvoice, Supplier, Category, BankAccount, Member,
} from '../types';
import { createDemoData, emptyOrgCategories } from '../demo-data';
import { blankOrganization } from '../defaults';
import { amountDue, documentTotals, invoiceTotal } from '../domain/calc';
import { addDays, todayISO } from '../domain/dates';
import { formatDocNumber } from '../domain/numbering';
import { invoiceStatus } from '../domain/status';
import { dueReminderStep } from '../domain/reminders';
import { dueRuns, nextOccurrence } from '../domain/recurring';
import { AUTO_MATCH_THRESHOLD, bestExpenseMatch, bestInvoiceMatch } from '../domain/matching';
import { findSupplier } from '../domain/categories';
import { formatEUR } from '../domain/money';
import { initials, publicToken, uid } from '../utils';
import { fillTemplate } from '../domain/template';
import { formatDateLong } from '../domain/dates';
import { invoiceEmail } from '../emails';

const now = () => new Date().toISOString();

/** Drop `undefined` values so they never overwrite defaults (e.g. `id: undefined` on create). */
function defined<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

export interface SendPayload {
  to: string;
  subject: string;
  body: string;
}

export interface PaymentInput {
  /** Payment provider id (Mollie tr_…); a second payment with the same id is ignored. */
  providerPaymentId?: string;
  date: string;
  amount: number;
  method: InvoicePayment['method'];
  note?: string;
  source?: InvoicePayment['source'];
  transactionId?: ID;
}

interface Actions {
  setActiveOrg: (id: ID) => void;
  createOrganization: (input: { name: string; kind: Organization['kind'] }) => ID;
  updateOrganization: (patch: Partial<Organization>) => void;

  saveCustomer: (c: Partial<Customer> & { companyName: string }) => ID;
  deleteCustomer: (id: ID) => void;

  saveProduct: (p: Partial<Product> & { name: string }) => ID;
  deleteProduct: (id: ID) => void;

  saveInvoice: (inv: Partial<Invoice> & { customerId: ID; lines: DocumentLine[] }) => ID;
  finalizeInvoice: (id: ID) => string;
  sendInvoice: (id: ID, mail: SendPayload) => void;
  markInvoiceViewed: (token: string) => void;
  registerPayment: (id: ID, p: PaymentInput) => void;
  createCreditNote: (id: ID) => ID;
  deleteInvoices: (ids: ID[]) => number;
  duplicateInvoice: (id: ID) => ID;
  sendReminder: (id: ID, mail?: SendPayload) => void;
  setInvoiceReminders: (id: ID, enabled: boolean) => void;
  bulkCreateInvoices: (input: { customerIds: ID[]; lines: DocumentLine[]; reference: string; issueDate: string; dueDate: string; note: string }) => ID[];

  saveQuote: (q: Partial<Quote> & { customerId: ID; lines: DocumentLine[] }) => ID;
  sendQuote: (id: ID, mail: SendPayload) => void;
  respondToQuote: (token: string, accepted: boolean) => void;
  convertQuoteToInvoice: (id: ID) => ID;
  deleteQuote: (id: ID) => void;

  saveRecurring: (r: Partial<RecurringInvoice> & { customerId: ID; lines: DocumentLine[]; name: string }) => ID;
  deleteRecurring: (id: ID) => void;

  saveExpense: (e: Partial<Expense> & { supplierName: string; total: number }) => ID;
  deleteExpense: (id: ID) => void;
  addCategory: (name: string) => void;
  deleteCategory: (id: ID) => void;
  saveSupplier: (s: Partial<Supplier> & { name: string }) => ID;

  addBankAccount: (a: Pick<BankAccount, 'bankName' | 'name' | 'iban'>) => ID;
  syncBank: (accountId?: ID) => number;
  /** Add transactions from a statement or the bank; returns how many were new and how many got matched. */
  importTransactions: (accountId: ID, items: Omit<BankTransaction, 'id' | 'organizationId' | 'accountId' | 'status'>[]) => { added: number; matched: number };
  confirmTransaction: (txId: ID) => void;
  linkTransactionToInvoice: (txId: ID, invoiceId: ID) => void;
  linkTransactionToExpense: (txId: ID, expenseId: ID) => void;
  categorizeTransaction: (txId: ID, category: string) => void;
  ignoreTransaction: (txId: ID) => void;
  unlinkTransaction: (txId: ID) => void;

  inviteMember: (m: Pick<Member, 'name' | 'email' | 'role'>) => void;

  pushNotification: (n: Omit<AppNotification, 'id' | 'createdAt' | 'read' | 'organizationId'> & { organizationId?: ID }) => void;
  markNotificationsRead: (ids?: ID[]) => void;

  /** Daily background work: reminders, recurring invoices, bank matching. */
  runAutomations: (opts?: { reminders?: boolean; recurring?: boolean; matching?: boolean }) => { reminders: number; recurring: number; matched: number };
  resetDemo: () => void;
  clearAll: () => void;
}

export type Store = AppData & Actions;

function currentOrg(s: AppData): Organization {
  return s.organizations.find((o) => o.id === s.activeOrgId) ?? s.organizations[0];
}

function customerName(s: AppData, id: ID) {
  return s.customers.find((c) => c.id === id)?.companyName ?? 'klant';
}

/** Assign the next invoice number of the invoice's administration. */
function withNumber(s: AppData, inv: Invoice): { inv: Invoice; orgs: Organization[] } {
  if (inv.number) return { inv, orgs: s.organizations };
  const org = s.organizations.find((o) => o.id === inv.organizationId)!;
  const number = formatDocNumber(org.invoicePrefix, org.nextInvoiceNumber);
  return {
    inv: { ...inv, number },
    orgs: s.organizations.map((o) => (o.id === org.id ? { ...o, nextInvoiceNumber: o.nextInvoiceNumber + 1 } : o)),
  };
}

function applyPayment(inv: Invoice, p: PaymentInput): Invoice {
  const payment: InvoicePayment = {
    id: uid('pay'), date: p.date, amount: p.amount, method: p.method, note: p.note ?? '', source: p.source ?? 'manual', transactionId: p.transactionId, providerPaymentId: p.providerPaymentId,
  };
  const payments = [...inv.payments, payment];
  const paidTotal = payments.reduce((sum, x) => sum + x.amount, 0);
  const full = paidTotal >= invoiceTotal(inv) - 0.004;
  return { ...inv, payments, state: full ? 'paid' : 'partial', paidAt: full ? p.date : inv.paidAt };
}

/** A reminder e-mail with the administration's own text, placeholders filled in. */
function reminderMail(org: Organization, customer: Customer | undefined, inv: Invoice, step: Organization['reminders']['steps'][number]) {
  const vars = {
    naam: customer?.contactName || customer?.companyName || '',
    factuurnummer: inv.number,
    bedrag: formatEUR(amountDue(inv)),
    bedrijf: org.name,
    vervaldatum: formatDateLong(inv.dueDate),
  };
  return { to: customer?.email ?? '', subject: fillTemplate(step.subject, vars), body: fillTemplate(step.body, vars) };
}

function notification(orgId: ID, n: Omit<AppNotification, 'id' | 'createdAt' | 'read' | 'organizationId'>): AppNotification {
  return { id: uid('ntf'), organizationId: orgId, createdAt: now(), read: false, ...n };
}

export function emptyData(): AppData {
  const year = new Date().getFullYear();
  const org = blankOrganization(uid('org'), 'Mijn administratie', year);
  return {
    user: { id: 'usr_me', name: 'Jij', email: '', initials: 'JIJ'.slice(0, 2) },
    activeOrgId: org.id,
    organizations: [org],
    members: [],
    customers: [], suppliers: [], products: [], invoices: [], quotes: [],
    categories: emptyOrgCategories(org.id), expenses: [], bankAccounts: [], transactions: [], recurring: [],
    notifications: [], emailLogs: [],
  };
}

/** Quota-safe localStorage: a full disk should never break the app. */

type SetState = (partial: Partial<Store> | ((s: Store) => Partial<Store>)) => void;
type GetState = () => Store;

export function createActions(set: SetState, get: GetState): Actions {
  return {

      setActiveOrg: (id) => set({ activeOrgId: id }),

      createOrganization: ({ name, kind }) => {
        const org = { ...blankOrganization(uid('org'), name, new Date().getFullYear()), kind, initials: initials(name) };
        if (kind === 'association') { org.vatRegistered = false; org.defaultVatRate = 0; }
        const s = get();
        set({
          organizations: [...s.organizations, org],
          categories: [...s.categories, ...emptyOrgCategories(org.id)],
          members: [...s.members, { id: uid('mem'), organizationId: org.id, name: s.user.name, email: s.user.email, role: 'owner' }],
          activeOrgId: org.id,
        });
        return org.id;
      },

      updateOrganization: (patch) => set((s) => ({
        organizations: s.organizations.map((o) => (o.id === s.activeOrgId ? { ...o, ...patch } : o)),
      })),

      saveCustomer: (c) => {
        const s = get();
        if (c.id && s.customers.some((x) => x.id === c.id)) {
          set({ customers: s.customers.map((x) => (x.id === c.id ? { ...x, ...c } : x)) });
          return c.id;
        }
        const org = currentOrg(s);
        const customer: Customer = {
          id: uid('cus'), organizationId: org.id, contactName: '', email: '', phone: '', address: '', postalCode: '', city: '',
          country: 'Nederland', kvk: '', vatNumber: '', iban: '', paymentTermDays: org.paymentTermDays, defaultInvoiceText: '',
          remindersEnabled: true, tags: [], createdAt: now(), ...defined(c),
        };
        set({ customers: [...s.customers, customer] });
        return customer.id;
      },
      deleteCustomer: (id) => set((s) => ({ customers: s.customers.filter((c) => c.id !== id) })),

      saveProduct: (p) => {
        const s = get();
        if (p.id && s.products.some((x) => x.id === p.id)) {
          set({ products: s.products.map((x) => (x.id === p.id ? { ...x, ...p } : x)) });
          return p.id;
        }
        const org = currentOrg(s);
        const product: Product = { id: uid('prd'), organizationId: org.id, description: '', price: 0, vatRate: org.defaultVatRate, unit: 'stuk', ...defined(p) };
        set({ products: [...s.products, product] });
        return product.id;
      },
      deleteProduct: (id) => set((s) => ({ products: s.products.filter((p) => p.id !== id) })),

      saveInvoice: (inv) => {
        const s = get();
        if (inv.id && s.invoices.some((x) => x.id === inv.id)) {
          set({ invoices: s.invoices.map((x) => (x.id === inv.id ? { ...x, ...inv } : x)) });
          return inv.id;
        }
        const org = currentOrg(s);
        const today = todayISO();
        const customer = s.customers.find((c) => c.id === inv.customerId);
        const invoice: Invoice = {
          id: uid('inv'), organizationId: org.id, kind: 'invoice', number: '', issueDate: today,
          dueDate: addDays(today, customer?.paymentTermDays ?? org.paymentTermDays), reference: '', note: org.defaultInvoiceNote,
          state: 'draft', payments: [], publicToken: publicToken(), remindersEnabled: true, remindersSent: [], createdAt: now(), ...defined(inv),
        };
        set({ invoices: [...s.invoices, invoice] });
        return invoice.id;
      },

      finalizeInvoice: (id) => {
        const s = get();
        const inv = s.invoices.find((x) => x.id === id)!;
        if (inv.state !== 'draft') return inv.number;
        const { inv: numbered, orgs } = withNumber(s, inv);
        set({ organizations: orgs, invoices: s.invoices.map((x) => (x.id === id ? { ...numbered, state: 'open' } : x)) });
        return numbered.number;
      },

      sendInvoice: (id, mail) => {
        get().finalizeInvoice(id);
        const s = get();
        const inv = s.invoices.find((x) => x.id === id)!;
        const log: EmailLog = { id: uid('mail'), organizationId: inv.organizationId, kind: 'invoice', invoiceId: id, to: mail.to, subject: mail.subject, body: mail.body, sentAt: now() };
        set({
          invoices: s.invoices.map((x) => (x.id === id ? { ...x, state: x.state === 'open' || x.state === 'draft' ? 'sent' : x.state, sentAt: now() } : x)),
          emailLogs: [...s.emailLogs, log],
        });
      },

      markInvoiceViewed: (token) => set((s) => ({
        invoices: s.invoices.map((x) => {
          if (x.publicToken !== token || x.viewedAt) return x;
          return { ...x, viewedAt: now(), state: x.state === 'sent' || x.state === 'open' ? 'viewed' : x.state };
        }),
      })),

      registerPayment: (id, p) => {
        const s = get();
        const inv = s.invoices.find((x) => x.id === id);
        if (!inv) return;
        if (p.providerPaymentId && inv.payments.some((x) => x.providerPaymentId === p.providerPaymentId)) return;
        const updated = applyPayment(inv, p);
        const notifications = [...s.notifications];
        if (updated.state === 'paid') {
          notifications.push(notification(inv.organizationId, {
            kind: 'paid', title: `Factuur ${inv.number} is betaald.`,
            body: `${customerName(s, inv.customerId)} betaalde ${formatEUR(p.amount)}${p.source === 'online' ? ' online via iDEAL' : p.source === 'bank' ? ' via de bank' : ''}.`,
            href: `/facturen/${inv.id}`,
          }));
        }
        set({ invoices: s.invoices.map((x) => (x.id === id ? updated : x)), notifications });
      },

      createCreditNote: (id) => {
        const s = get();
        const orig = s.invoices.find((x) => x.id === id)!;
        const base: Invoice = {
          ...orig,
          id: uid('inv'), kind: 'credit', number: '', issueDate: todayISO(), dueDate: todayISO(),
          reference: `Creditering van factuur ${orig.number}`,
          lines: orig.lines.map((l) => ({ ...l, id: uid('ln'), quantity: -l.quantity })),
          note: `Deze creditfactuur hoort bij factuur ${orig.number} van ${orig.issueDate.split('-').reverse().join('-')}.`,
          state: 'open', payments: [], publicToken: publicToken(), creditOfId: orig.id, creditedById: undefined,
          sentAt: undefined, viewedAt: undefined, paidAt: undefined, remindersSent: [], remindersEnabled: false, createdAt: now(),
        };
        const { inv: credit, orgs } = withNumber(s, base);
        // Whatever was already paid stays paid; the credit note settles the rest.
        const settled = { ...credit, state: 'paid' as const, paidAt: todayISO() };
        set({
          organizations: orgs,
          invoices: [...s.invoices.map((x) => (x.id === id ? { ...x, state: 'credited' as const, creditedById: credit.id } : x)), settled],
        });
        return credit.id;
      },

      deleteInvoices: (ids) => {
        const s = get();
        const deletable = new Set(s.invoices.filter((x) => ids.includes(x.id) && x.state === 'draft').map((x) => x.id));
        set({ invoices: s.invoices.filter((x) => !deletable.has(x.id)) });
        return deletable.size;
      },

      duplicateInvoice: (id) => {
        const s = get();
        const orig = s.invoices.find((x) => x.id === id)!;
        return get().saveInvoice({
          customerId: orig.customerId, lines: orig.lines.map((l) => ({ ...l, id: uid('ln') })), reference: orig.reference, note: orig.note,
        });
      },

      sendReminder: (id, mail) => {
        const s = get();
        const inv = s.invoices.find((x) => x.id === id)!;
        const org = s.organizations.find((o) => o.id === inv.organizationId)!;
        const sentIds = new Set(inv.remindersSent.map((r) => r.stepId));
        const step = org.reminders.steps.find((st) => !sentIds.has(st.id)) ?? org.reminders.steps[org.reminders.steps.length - 1];
        const customer = s.customers.find((c) => c.id === inv.customerId);
        const auto = reminderMail(org, customer, inv, step);
        const log: EmailLog = {
          id: uid('mail'), organizationId: inv.organizationId, kind: 'reminder', invoiceId: id, to: mail?.to ?? auto.to,
          subject: mail?.subject ?? auto.subject, body: mail?.body ?? auto.body, sentAt: now(),
        };
        set({
          invoices: s.invoices.map((x) => (x.id === id ? { ...x, remindersSent: [...x.remindersSent, { stepId: step.id, sentAt: now() }] } : x)),
          emailLogs: [...s.emailLogs, log],
        });
      },

      setInvoiceReminders: (id, enabled) => set((s) => ({ invoices: s.invoices.map((x) => (x.id === id ? { ...x, remindersEnabled: enabled } : x)) })),

      bulkCreateInvoices: ({ customerIds, lines, reference, issueDate, dueDate, note }) => {
        let s = get();
        const org = currentOrg(s);
        const created: Invoice[] = [];
        let next = org.nextInvoiceNumber;
        for (const cid of customerIds) {
          created.push({
            id: uid('inv'), organizationId: org.id, kind: 'invoice', number: formatDocNumber(org.invoicePrefix, next++), customerId: cid,
            issueDate, dueDate, reference, lines: lines.map((l) => ({ ...l, id: uid('ln') })), note, state: 'open', payments: [],
            publicToken: publicToken(), remindersEnabled: true, remindersSent: [], createdAt: now(),
          });
        }
        s = get();
        set({
          invoices: [...s.invoices, ...created],
          organizations: s.organizations.map((o) => (o.id === org.id ? { ...o, nextInvoiceNumber: next } : o)),
        });
        return created.map((c) => c.id);
      },

      saveQuote: (q) => {
        const s = get();
        if (q.id && s.quotes.some((x) => x.id === q.id)) {
          set({ quotes: s.quotes.map((x) => (x.id === q.id ? { ...x, ...q } : x)) });
          return q.id;
        }
        const org = currentOrg(s);
        const today = todayISO();
        const quote: Quote = {
          id: uid('quo'), organizationId: org.id, number: formatDocNumber(org.quotePrefix, org.nextQuoteNumber), issueDate: today,
          validUntil: addDays(today, org.quoteValidDays), reference: '', note: `Deze offerte is ${org.quoteValidDays} dagen geldig.`,
          state: 'draft', publicToken: publicToken(), createdAt: now(), ...defined(q),
        };
        set({
          quotes: [...s.quotes, quote],
          organizations: s.organizations.map((o) => (o.id === org.id ? { ...o, nextQuoteNumber: o.nextQuoteNumber + 1 } : o)),
        });
        return quote.id;
      },

      sendQuote: (id, mail) => set((s) => {
        const q = s.quotes.find((x) => x.id === id)!;
        return {
          quotes: s.quotes.map((x) => (x.id === id ? { ...x, state: x.state === 'draft' ? 'sent' : x.state, sentAt: now() } : x)),
          emailLogs: [...s.emailLogs, { id: uid('mail'), organizationId: q.organizationId, kind: 'quote', quoteId: id, to: mail.to, subject: mail.subject, body: mail.body, sentAt: now() }],
        };
      }),

      respondToQuote: (token, accepted) => set((s) => {
        const q = s.quotes.find((x) => x.publicToken === token);
        if (!q) return {};
        return {
          quotes: s.quotes.map((x) => (x.id === q.id ? { ...x, state: accepted ? 'accepted' : 'declined', respondedAt: now() } : x)),
          notifications: [...s.notifications, notification(q.organizationId, {
            kind: 'quote', title: `Offerte ${q.number} is ${accepted ? 'geaccepteerd' : 'afgewezen'}.`,
            body: `${customerName(s, q.customerId)} heeft de offerte online ${accepted ? 'geaccepteerd' : 'afgewezen'}.`, href: `/offertes/${q.id}`,
          })],
        };
      }),

      convertQuoteToInvoice: (id) => {
        const s = get();
        const q = s.quotes.find((x) => x.id === id)!;
        const invoiceId = get().saveInvoice({
          customerId: q.customerId, lines: q.lines.map((l) => ({ ...l, id: uid('ln') })),
          reference: q.reference || `Offerte ${q.number}`, quoteId: q.id,
        });
        set((st) => ({ quotes: st.quotes.map((x) => (x.id === id ? { ...x, invoiceId, state: 'accepted' } : x)) }));
        return invoiceId;
      },

      deleteQuote: (id) => set((s) => ({ quotes: s.quotes.filter((q) => q.id !== id) })),

      saveRecurring: (r) => {
        const s = get();
        if (r.id && s.recurring.some((x) => x.id === r.id)) {
          set({ recurring: s.recurring.map((x) => (x.id === r.id ? { ...x, ...r } : x)) });
          return r.id;
        }
        const today = todayISO();
        const rec: RecurringInvoice = {
          id: uid('rec'), organizationId: currentOrg(s).id, frequency: 'monthly', startDate: today, nextDate: today,
          autoCreate: true, autoSend: false, active: true, invoiceIds: [], ...defined(r),
        };
        if (!r.nextDate) rec.nextDate = rec.startDate;
        set({ recurring: [...s.recurring, rec] });
        return rec.id;
      },
      deleteRecurring: (id) => set((s) => ({ recurring: s.recurring.filter((r) => r.id !== id) })),

      saveExpense: (e) => {
        const s = get();
        const org = currentOrg(s);
        // Remember the supplier and its category for next time.
        let suppliers = s.suppliers;
        const orgSuppliers = suppliers.filter((x) => x.organizationId === org.id);
        const known = findSupplier(e.supplierName, orgSuppliers);
        let supplierId = known?.id;
        if (e.category && e.status !== 'review') {
          if (known) {
            suppliers = suppliers.map((x) => (x.id === known.id ? { ...x, defaultCategory: e.category!, defaultVatRate: e.vatRate ?? x.defaultVatRate, timesUsed: x.timesUsed + 1, iban: x.iban || e.iban || '' } : x));
          } else if (e.supplierName.trim()) {
            const ns: Supplier = {
              id: uid('sup'), organizationId: org.id, name: e.supplierName.trim(), defaultCategory: e.category, defaultVatRate: e.vatRate ?? 21,
              iban: e.iban ?? '', email: '', website: '', timesUsed: 1,
            };
            suppliers = [...suppliers, ns];
            supplierId = ns.id;
          }
        }
        if (e.id && s.expenses.some((x) => x.id === e.id)) {
          set({ suppliers, expenses: s.expenses.map((x) => (x.id === e.id ? { ...x, ...e, supplierId: supplierId ?? x.supplierId } : x)) });
          return e.id;
        }
        const expense: Expense = {
          id: uid('exp'), organizationId: org.id, kind: 'receipt', invoiceNumber: '', date: todayISO(), subtotal: e.total, vatAmount: 0,
          vatRate: 21, category: 'Overig', description: '', iban: '', status: 'processed', paid: true, source: 'upload',
          document: { fileName: 'document', mimeType: 'image/jpeg' }, createdAt: now(), ...defined(e), supplierId,
        };
        // Try to link it to a bank payment straight away.
        let transactions = s.transactions;
        const candidates = transactions.filter((t) => t.organizationId === org.id && t.amount < 0 && (t.status === 'todo' || t.status === 'suggested') && !t.invoiceId);
        for (const t of candidates) {
          const m = bestExpenseMatch(t, [expense]);
          if (m && m.confidence >= 85) {
            transactions = transactions.map((x) => (x.id === t.id ? { ...x, status: 'suggested', expenseId: expense.id, confidence: m.confidence } : x));
            break;
          }
        }
        set({ suppliers, expenses: [...s.expenses, expense], transactions });
        return expense.id;
      },
      deleteExpense: (id) => set((s) => ({
        expenses: s.expenses.filter((e) => e.id !== id),
        transactions: s.transactions.map((t) => (t.expenseId === id ? { ...t, expenseId: undefined, status: 'todo' } : t)),
      })),

      addCategory: (name) => set((s) => ({
        categories: [...s.categories, { id: uid('cat'), organizationId: s.activeOrgId, name, icon: 'tag', custom: true } satisfies Category],
      })),
      deleteCategory: (id) => set((s) => ({ categories: s.categories.filter((c) => c.id !== id) })),

      saveSupplier: (sp) => {
        const s = get();
        if (sp.id && s.suppliers.some((x) => x.id === sp.id)) {
          set({ suppliers: s.suppliers.map((x) => (x.id === sp.id ? { ...x, ...sp } : x)) });
          return sp.id;
        }
        const supplier: Supplier = {
          id: uid('sup'), organizationId: s.activeOrgId, defaultCategory: 'Overig', defaultVatRate: 21, iban: '', email: '', website: '', timesUsed: 0, ...defined(sp),
        };
        set({ suppliers: [...s.suppliers, supplier] });
        return supplier.id;
      },

      addBankAccount: (a) => {
        const s = get();
        const today = todayISO();
        const acc: BankAccount = {
          id: uid('acc'), organizationId: s.activeOrgId, balance: 0, provider: 'demo', connectedAt: now(), lastSyncAt: now(),
          consentValidUntil: addDays(today, 90), color: '#1F2A44', ...a,
        };
        set({ bankAccounts: [...s.bankAccounts, acc] });
        return acc.id;
      },

      syncBank: (accountId) => {
        // Demo: simulate the PSD2 provider delivering new transactions.
        const s = get();
        const org = currentOrg(s);
        const account = s.bankAccounts.find((a) => a.id === accountId) ?? s.bankAccounts.find((a) => a.organizationId === org.id);
        if (!account) return 0;
        const today = todayISO();
        const open = s.invoices.filter((i) => i.organizationId === org.id && ['sent', 'viewed', 'open', 'partial'].includes(i.state) && amountDue(i) > 0);
        const fresh: BankTransaction[] = [];
        const target = open.find((i) => !s.transactions.some((t) => t.invoiceId === i.id && t.status !== 'matched'));
        if (target) {
          const c = s.customers.find((x) => x.id === target.customerId);
          fresh.push({
            id: uid('tx'), organizationId: org.id, accountId: account.id, date: today, description: `Betaling factuur ${target.number}`,
            counterparty: c?.companyName ?? 'Onbekend', counterpartyIban: c?.iban ?? '', amount: amountDue(target), status: 'todo',
          });
        }
        fresh.push({
          id: uid('tx'), organizationId: org.id, accountId: account.id, date: today, description: 'Tankstation Veendam',
          counterparty: 'Shell Veendam', counterpartyIban: '', amount: -64.12, status: 'todo',
        });
        const balance = fresh.reduce((sum, t) => sum + t.amount, account.balance);
        set({
          transactions: [...s.transactions, ...fresh],
          bankAccounts: s.bankAccounts.map((a) => (a.id === account.id ? { ...a, lastSyncAt: now(), balance } : a)),
        });
        get().runAutomations();
        return fresh.length;
      },

      importTransactions: (accountId, items) => {
        const s = get();
        const account = s.bankAccounts.find((a) => a.id === accountId);
        if (!account) return { added: 0, matched: 0 };
        const known = new Set(s.transactions.filter((t) => t.organizationId === account.organizationId).map((t) => t.externalId).filter(Boolean));
        const fresh: BankTransaction[] = items
          .filter((t) => !t.externalId || !known.has(t.externalId))
          .map((t) => ({ ...t, id: uid('tx'), organizationId: account.organizationId, accountId, status: 'todo' as const }));
        if (!fresh.length) return { added: 0, matched: 0 };
        const latest = fresh.reduce((d, t) => (t.date > d ? t.date : d), '');
        set({
          transactions: [...s.transactions, ...fresh],
          bankAccounts: s.bankAccounts.map((a) => (a.id === accountId ? { ...a, lastSyncAt: now(), lastImportDate: latest > (a.lastImportDate ?? '') ? latest : a.lastImportDate } : a)),
        });
        const { matched } = get().runAutomations({ reminders: false, recurring: false, matching: true });
        return { added: fresh.length, matched };
      },

      confirmTransaction: (txId) => {
        const s = get();
        const t = s.transactions.find((x) => x.id === txId);
        if (!t) return;
        if (t.invoiceId) return get().linkTransactionToInvoice(txId, t.invoiceId);
        if (t.expenseId) return get().linkTransactionToExpense(txId, t.expenseId);
      },

      linkTransactionToInvoice: (txId, invoiceId) => {
        const s = get();
        const t = s.transactions.find((x) => x.id === txId)!;
        const inv = s.invoices.find((x) => x.id === invoiceId)!;
        set({ transactions: s.transactions.map((x) => (x.id === txId ? { ...x, status: 'matched', invoiceId, expenseId: undefined } : x)) });
        get().registerPayment(invoiceId, {
          date: t.date, amount: Math.min(t.amount, amountDue(inv)), method: 'bank', source: 'bank', transactionId: t.id,
        });
      },

      linkTransactionToExpense: (txId, expenseId) => set((s) => ({
        transactions: s.transactions.map((x) => (x.id === txId ? { ...x, status: 'matched', expenseId, invoiceId: undefined } : x)),
        expenses: s.expenses.map((e) => (e.id === expenseId ? { ...e, transactionId: txId, paid: true } : e)),
      })),

      categorizeTransaction: (txId, category) => set((s) => ({
        transactions: s.transactions.map((x) => (x.id === txId ? { ...x, status: 'categorized', category, invoiceId: undefined, expenseId: undefined } : x)),
      })),

      ignoreTransaction: (txId) => set((s) => ({ transactions: s.transactions.map((x) => (x.id === txId ? { ...x, status: 'ignored' } : x)) })),

      unlinkTransaction: (txId) => set((s) => {
        const t = s.transactions.find((x) => x.id === txId)!;
        return {
          transactions: s.transactions.map((x) => (x.id === txId ? { ...x, status: 'todo', invoiceId: undefined, expenseId: undefined, category: undefined, confidence: undefined } : x)),
          invoices: t.invoiceId && t.status === 'matched'
            ? s.invoices.map((inv) => {
              if (inv.id !== t.invoiceId) return inv;
              const payments = inv.payments.filter((p) => p.transactionId !== txId);
              const paid = payments.reduce((sum, p) => sum + p.amount, 0);
              return { ...inv, payments, state: paid <= 0 ? (inv.viewedAt ? 'viewed' : 'sent') : paid >= invoiceTotal(inv) - 0.004 ? 'paid' : 'partial', paidAt: paid >= invoiceTotal(inv) - 0.004 ? inv.paidAt : undefined };
            })
            : s.invoices,
          expenses: t.expenseId ? s.expenses.map((e) => (e.id === t.expenseId ? { ...e, transactionId: undefined } : e)) : s.expenses,
        };
      }),

      inviteMember: (m) => set((s) => ({ members: [...s.members, { id: uid('mem'), organizationId: s.activeOrgId, ...m }] })),

      pushNotification: (n) => set((s) => ({ notifications: [...s.notifications, notification(n.organizationId ?? s.activeOrgId, n)] })),
      markNotificationsRead: (ids) => set((s) => ({
        notifications: s.notifications.map((n) => (n.organizationId === s.activeOrgId && (!ids || ids.includes(n.id)) ? { ...n, read: true } : n)),
      })),

      runAutomations: (opts = {}) => {
        const run = { reminders: true, recurring: true, matching: true, ...opts };
        const today = todayISO();
        let reminders = 0;
        let recurring = 0;
        let matched = 0;
        for (const org of get().organizations) {
          // 1. Recurring invoices
          if (run.recurring && org.automations.createRecurring) {
            for (const rec of get().recurring.filter((r) => r.organizationId === org.id && r.active && r.autoCreate)) {
              const runs = dueRuns(rec.nextDate, rec.frequency, today, rec.endDate);
              for (const date of runs) {
                const s = get();
                const customer = s.customers.find((c) => c.id === rec.customerId);
                let inv: Invoice = {
                  id: uid('inv'), organizationId: org.id, kind: 'invoice', number: '', customerId: rec.customerId, issueDate: date,
                  dueDate: addDays(date, customer?.paymentTermDays ?? org.paymentTermDays), reference: rec.name,
                  lines: rec.lines.map((l) => ({ ...l, id: uid('ln') })), note: org.defaultInvoiceNote, state: 'draft', payments: [],
                  publicToken: publicToken(), recurringId: rec.id, remindersEnabled: true, remindersSent: [], createdAt: now(),
                };
                const sendIt = rec.autoSend && org.automations.sendRecurring;
                const numbered = withNumber(s, inv);
                inv = { ...numbered.inv, state: sendIt && customer?.email ? 'sent' : 'open', sentAt: sendIt && customer?.email ? now() : undefined };
                const mails: EmailLog[] = sendIt && customer?.email
                  ? [{ id: uid('mail'), organizationId: org.id, kind: 'invoice', invoiceId: inv.id, ...invoiceEmail(org, customer, inv), sentAt: now() }]
                  : [];
                set({
                  organizations: numbered.orgs,
                  invoices: [...s.invoices, inv],
                  emailLogs: [...s.emailLogs, ...mails],
                  recurring: s.recurring.map((r) => (r.id === rec.id ? { ...r, nextDate: nextOccurrence(date, r.frequency), invoiceIds: [...r.invoiceIds, inv.id] } : r)),
                  notifications: [...s.notifications, notification(org.id, {
                    kind: 'recurring', title: `Periodieke factuur ${inv.number} is ${sendIt ? 'verstuurd' : 'aangemaakt'}.`,
                    body: `${rec.name} voor ${customer?.companyName ?? 'klant'} · ${formatEUR(invoiceTotal(inv))}`, href: `/facturen/${inv.id}`,
                  })],
                });
                recurring++;
              }
            }
          }
          // 2. Payment reminders
          if (run.reminders && org.automations.sendReminders) {
            for (const inv of get().invoices.filter((i) => i.organizationId === org.id && i.kind === 'invoice')) {
              const s = get();
              const step = dueReminderStep(inv, org, s.customers.find((c) => c.id === inv.customerId), today);
              if (!step) continue;
              set({
                invoices: s.invoices.map((x) => (x.id === inv.id ? { ...x, remindersSent: [...x.remindersSent, { stepId: step.id, sentAt: now() }] } : x)),
                emailLogs: [...s.emailLogs, {
                  id: uid('mail'), organizationId: org.id, kind: 'reminder', invoiceId: inv.id,
                  ...reminderMail(org, s.customers.find((c) => c.id === inv.customerId), inv, step), sentAt: now(),
                }],
                notifications: [...s.notifications, notification(org.id, {
                  kind: 'overdue', title: `${step.label} verstuurd voor factuur ${inv.number}.`, href: `/facturen/${inv.id}`,
                })],
              });
              reminders++;
            }
          }
          // 3. Bank matching
          if (run.matching) {
            const s = get();
            const openInv = s.invoices.filter((i) => i.organizationId === org.id && i.kind === 'invoice' && amountDue(i) > 0 && i.state !== 'draft');
            const customers = new Map(s.customers.filter((c) => c.organizationId === org.id).map((c) => [c.id, c]));
            const reviewExpenses = s.expenses.filter((e) => e.organizationId === org.id);
            for (const t of s.transactions.filter((x) => x.organizationId === org.id && x.status === 'todo')) {
              const m = bestInvoiceMatch(t, openInv, customers);
              if (m) {
                if (m.confidence >= AUTO_MATCH_THRESHOLD && org.automations.autoMarkPaidOnBankMatch) {
                  set((st) => ({ transactions: st.transactions.map((x) => (x.id === t.id ? { ...x, confidence: m.confidence, autoMatched: true } : x)) }));
                  get().linkTransactionToInvoice(t.id, m.invoiceId);
                  matched++;
                } else {
                  set((st) => ({ transactions: st.transactions.map((x) => (x.id === t.id ? { ...x, status: 'suggested', invoiceId: m.invoiceId, confidence: m.confidence } : x)) }));
                }
                continue;
              }
              const em = bestExpenseMatch(t, reviewExpenses);
              if (em) {
                set((st) => ({ transactions: st.transactions.map((x) => (x.id === t.id ? { ...x, status: 'suggested', expenseId: em.expenseId, confidence: em.confidence } : x)) }));
              }
            }
          }
        }
        if (run.reminders && run.recurring) set({ automationsRanOn: today });
        return { reminders, recurring, matched };
      },

      resetDemo: () => set({ ...createDemoData() }),
      clearAll: () => set({ ...emptyData() }),
  };
}

/** The serialisable part of the store (what is saved / synced). */
export function pickData(s: AppData): AppData {
  return {
    user: s.user, activeOrgId: s.activeOrgId, organizations: s.organizations, members: s.members, customers: s.customers,
    suppliers: s.suppliers, products: s.products, invoices: s.invoices, quotes: s.quotes, categories: s.categories,
    expenses: s.expenses, bankAccounts: s.bankAccounts, transactions: s.transactions, recurring: s.recurring,
    notifications: s.notifications, emailLogs: s.emailLogs, automationsRanOn: s.automationsRanOn,
  };
}
