import type {
  AppData, BankTransaction, Category, Customer, DocumentLine, EmailLog, Expense, Invoice,
  Organization, Product, Quote, RecurringInvoice, Supplier, VatRate, AppNotification,
} from './types';
import { blankOrganization } from './defaults';
import { DEFAULT_CATEGORIES } from './domain/categories';
import { addDays, parseISODate, toISODate, todayISO } from './domain/dates';
import { documentTotals, splitVat } from './domain/calc';
import { round2 } from './domain/money';
import { uid } from './utils';

/** Small deterministic PRNG so the demo looks the same on every reset. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let seq = 0;
let tokenRand = rng(7);
const TOKEN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/** Deterministic, so links in the demo survive a reset. */
const publicToken = () => Array.from({ length: 10 }, () => TOKEN_ALPHABET[Math.floor(tokenRand() * TOKEN_ALPHABET.length)]).join('');
const id = (p: string) => `${p}_${(++seq).toString(36).padStart(4, '0')}`;
const ts = (date: string, hour = 10) => `${date}T${String(hour).padStart(2, '0')}:${String((hour * 7) % 60).padStart(2, '0')}:00.000Z`;

function line(description: string, quantity: number, unit: string, unitPrice: number, vatRate: VatRate = 21, discountPct = 0): DocumentLine {
  return { id: id('ln'), description, quantity, unit, unitPrice, vatRate, discountPct };
}

function categoriesFor(orgId: string, extra: string[] = []): Category[] {
  return [
    ...DEFAULT_CATEGORIES.map((c) => ({ id: id('cat'), organizationId: orgId, name: c.name, icon: c.icon, custom: false })),
    ...extra.map((name) => ({ id: id('cat'), organizationId: orgId, name, icon: 'tag', custom: true })),
  ];
}

interface Builder {
  invoices: Invoice[];
  expenses: Expense[];
  transactions: BankTransaction[];
  emailLogs: EmailLog[];
}

export function createDemoData(today = todayISO()): AppData {
  seq = 0;
  tokenRand = rng(7);
  const year = parseISODate(today).getFullYear();
  const monthStart = toISODate(new Date(year, parseISODate(today).getMonth(), 1));
  const b: Builder = { invoices: [], expenses: [], transactions: [], emailLogs: [] };

  /* ───────────────────────── Muldersign ───────────────────────── */
  const ms: Organization = {
    ...blankOrganization('org_muldersign', 'Muldersign', year),
    name: 'Muldersign',
    tradeName: 'Muldersign Grafisch & Webdesign',
    initials: 'MS',
    address: 'Kerkstraat 14',
    postalCode: '9641 AN',
    city: 'Veendam',
    kvk: '81234567',
    vatNumber: 'NL003412345B01',
    iban: 'NL00INGB0123456789',
    bic: 'INGBNL2A',
    email: 'hallo@muldersign.nl',
    phone: '06 12 34 56 78',
    website: 'muldersign.nl',
    accentColor: '#171717',
    nextInvoiceNumber: 38,
    nextQuoteNumber: 14,
    inboxAddress: 'muldersign-7K2F@inbox.brenqo.nl',
    payments: {
      provider: 'mollie',
      connected: true,
      payLinkOnInvoice: true,
      payButtonInEmail: true,
      methods: { ideal: true, bancontact: false, creditcard: false, banktransfer: true },
    },
  };

  const msCustomers: Customer[] = [
    ['De Leo Media', 'Leo de Vries', 'leo@deleomedia.nl', '0592 123 456', 'Industrieweg 8', '9403 AB', 'Assen', 'NL20RABO0312345678', 14],
    ['GymSupplies', 'Sanne Bakker', 'administratie@gymsupplies.nl', '050 211 3344', 'Peizerweg 120', '9727 AN', 'Groningen', 'NL44ABNA0456789012', 30],
    ['Gemeente Borger-Odoorn', 'Marieke Jansen', 'facturen@borger-odoorn.nl', '0591 535 353', 'Hoofdstraat 24', '7881 BB', 'Exloo', 'NL18BNGH0285001234', 30],
    ['PM Agency', 'Pieter Meijer', 'pieter@pmagency.nl', '0591 744 220', 'Noordbargerstraat 35', '7812 AB', 'Emmen', 'NL55INGB0007654321', 7],
    ['Studio Noord', 'Lisa Hoekstra', 'lisa@studionoord.nl', '0598 610 707', 'Museumplein 3', '9641 AD', 'Veendam', 'NL71RABO0398765432', 30],
    ['Bakkerij Hamstra', 'Jan Hamstra', 'info@bakkerijhamstra.nl', '0599 612 345', 'Hoofdstraat 102', '9501 CG', 'Stadskanaal', 'NL09INGB0001122334', 14],
    ['Fysio Vlagtwedde', 'Eva Koster', 'eva@fysiovlagtwedde.nl', '0599 312 909', 'Wilhelminalaan 6', '9541 AE', 'Vlagtwedde', 'NL63RABO0311223344', 14],
    ['Autobedrijf Kremer', 'Henk Kremer', 'henk@autobedrijfkremer.nl', '0598 452 100', 'Transportweg 17', '9645 KZ', 'Veendam', 'NL32ABNA0498877665', 30],
  ].map(([companyName, contactName, email, phone, address, postalCode, city, iban, term], i) => ({
    id: id('cus'),
    organizationId: ms.id,
    companyName: companyName as string,
    contactName: contactName as string,
    email: email as string,
    phone: phone as string,
    address: address as string,
    postalCode: postalCode as string,
    city: city as string,
    country: 'Nederland',
    kvk: String(60000000 + i * 1234567).slice(0, 8),
    vatNumber: companyName === 'Gemeente Borger-Odoorn' ? '' : `NL00${String(1234567 + i * 98765).slice(0, 7)}B01`,
    iban: iban as string,
    paymentTermDays: term as number,
    defaultInvoiceText: '',
    remindersEnabled: companyName !== 'Gemeente Borger-Odoorn',
    tags: [],
    createdAt: ts(addDays(today, -400 + i * 20)),
  }));
  const C = Object.fromEntries(msCustomers.map((c) => [c.companyName, c]));

  const msProducts: Product[] = [
    ['Grafisch ontwerp', 'Ontwerpwerkzaamheden op uurbasis', 65, 'uur'],
    ['Website onderhoud', 'Updates, beveiliging en kleine aanpassingen', 75, 'uur'],
    ['Hosting', 'Snelle, veilige hosting inclusief SSL en back-ups', 180, 'jaar'],
    ['Logo ontwerp', 'Drie concepten, twee correctierondes en alle bestanden', 450, 'stuk'],
    ['Huisstijlhandboek', 'Complete huisstijl met richtlijnen en templates', 950, 'stuk'],
    ['Drukwerkbegeleiding', 'Aanleveren, proefdrukken en contact met drukkerij', 55, 'uur'],
    ['Domeinnaam', 'Registratie en beheer .nl-domein', 15, 'jaar'],
    ['SEO-check', 'Technische analyse met concrete verbeterpunten', 295, 'stuk'],
  ].map(([name, description, price, unit]) => ({
    id: id('prd'), organizationId: ms.id, name: name as string, description: description as string,
    price: price as number, vatRate: 21 as VatRate, unit: unit as string,
  }));

  const rand = rng(42);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];

  function makeInvoice(
    org: Organization, customer: Customer, number: string, issueDate: string, lines: DocumentLine[],
    opts: { paidOn?: string; paidAmount?: number; state?: Invoice['state']; reminders?: number[]; reference?: string; viewed?: boolean; via?: 'bank' | 'online' } = {},
  ): Invoice {
    const dueDate = addDays(issueDate, customer.paymentTermDays || org.paymentTermDays);
    const total = documentTotals(lines).total;
    const inv: Invoice = {
      id: id('inv'),
      organizationId: org.id,
      kind: 'invoice',
      number,
      customerId: customer.id,
      issueDate,
      dueDate,
      reference: opts.reference ?? '',
      lines,
      note: org.defaultInvoiceNote,
      state: opts.state ?? 'sent',
      payments: [],
      publicToken: publicToken(),
      sentAt: ts(issueDate, 9),
      viewedAt: opts.viewed ? ts(addDays(issueDate, 1), 14) : undefined,
      remindersEnabled: true,
      remindersSent: (opts.reminders ?? []).map((d, i) => ({ stepId: `r${i + 1}`, sentAt: ts(addDays(dueDate, d), 8) })),
      createdAt: ts(issueDate, 9),
    };
    if (inv.state !== 'draft') {
      b.emailLogs.push({
        id: id('mail'), organizationId: org.id, kind: 'invoice', invoiceId: inv.id, to: customer.email,
        subject: `Factuur ${number} van ${org.name}`, body: '', sentAt: inv.sentAt!,
      });
    }
    if (opts.paidOn) {
      const amount = opts.paidAmount ?? total;
      const via = opts.via ?? (rand() > 0.45 ? 'online' : 'bank');
      inv.payments.push({
        id: id('pay'), date: opts.paidOn, amount, method: via === 'online' ? 'ideal' : 'bank',
        note: '', source: via,
      });
      inv.state = amount >= total - 0.004 ? 'paid' : 'partial';
      if (inv.state === 'paid') inv.paidAt = opts.paidOn;
    }
    b.invoices.push(inv);
    return inv;
  }

  // Historic invoices — previous year (full year) and current year up to ~6 weeks ago.
  const historicLines = (): DocumentLine[] => {
    const r = rand();
    if (r < 0.25) return [line('Grafisch ontwerp', Math.round(4 + rand() * 18), 'uur', 65)];
    if (r < 0.45) return [line('Website onderhoud', Math.round(2 + rand() * 8), 'uur', 75), line('Hosting', 1, 'jaar', 180)];
    if (r < 0.6) return [line('Logo ontwerp', 1, 'stuk', 450), line('Grafisch ontwerp', Math.round(2 + rand() * 6), 'uur', 65)];
    if (r < 0.72) return [line('Huisstijlhandboek', 1, 'stuk', 950)];
    if (r < 0.85) return [line('Ontwerp brochure en flyers', 1, 'stuk', Math.round(380 + rand() * 600)), line('Drukwerkbegeleiding', Math.round(1 + rand() * 4), 'uur', 55)];
    return [line('Website redesign', 1, 'stuk', Math.round(1400 + rand() * 1600)), line('SEO-check', 1, 'stuk', 295)];
  };
  const regular = msCustomers;

  const prevStart = toISODate(new Date(year - 1, 0, 6));
  const prevEnd = toISODate(new Date(year - 1, 11, 18));
  const prevCount = 41;
  for (let i = 0; i < prevCount; i++) {
    const t = parseISODate(prevStart).getTime() + ((parseISODate(prevEnd).getTime() - parseISODate(prevStart).getTime()) * i) / (prevCount - 1);
    const d = toISODate(new Date(t));
    const cust = pick(regular);
    makeInvoice(ms, cust, `${year - 1}-${String(i + 1).padStart(3, '0')}`, d, historicLines(), {
      paidOn: addDays(d, Math.round(3 + rand() * 20)), viewed: true,
    });
  }
  const curStart = toISODate(new Date(year, 0, 7));
  const curEnd = addDays(today, -48);
  const curCount = 29;
  for (let i = 0; i < curCount; i++) {
    const span = Math.max(0, parseISODate(curEnd).getTime() - parseISODate(curStart).getTime());
    const d = toISODate(new Date(parseISODate(curStart).getTime() + (span * i) / (curCount - 1)));
    const cust = pick(regular);
    const inv = makeInvoice(ms, cust, `${year}-${String(i + 1).padStart(3, '0')}`, d, historicLines(), {
      paidOn: addDays(d, Math.round(4 + rand() * 18)), viewed: true,
    });
    if (i === 11) {
      // A credited invoice and its credit note, to show how that looks.
      inv.state = 'credited';
      inv.payments = [];
      inv.paidAt = undefined;
    }
  }
  // Credit note for the credited invoice above.
  const credited = b.invoices.find((x) => x.organizationId === ms.id && x.state === 'credited')!;
  // (numbered in sequence after it would break chronology; we store it with its own date)
  const creditNote: Invoice = {
    ...credited,
    id: id('inv'),
    kind: 'credit',
    number: `${year}-${String(13).padStart(3, '0')}`,
    issueDate: addDays(credited.issueDate, 2),
    dueDate: addDays(credited.issueDate, 2),
    lines: credited.lines.map((l) => ({ ...l, id: id('ln'), quantity: -l.quantity })),
    state: 'paid',
    payments: [],
    publicToken: publicToken(),
    creditOfId: credited.id,
    reference: `Creditering van ${credited.number}`,
    note: 'Deze creditfactuur vervangt de oorspronkelijke factuur volledig.',
    remindersSent: [],
  };
  credited.creditedById = creditNote.id;
  // Renumber the historic invoices after the credited one so numbering stays gapless.
  const curYearInv = b.invoices.filter((x) => x.organizationId === ms.id && x.number.startsWith(`${year}-`));
  curYearInv.forEach((x, i) => {
    const n = i < 12 ? i + 1 : i + 2;
    x.number = `${year}-${String(n).padStart(3, '0')}`;
  });
  b.invoices.push(creditNote);
  // Now 001–030 exist (029 historic + 1 credit note). Specials continue at 031.
  const n = (k: number) => `${year}-${String(k).padStart(3, '0')}`;

  makeInvoice(ms, C['Fysio Vlagtwedde'], n(31), addDays(today, -44), [line('Ontwerp folder behandelaanbod', 1, 'stuk', 250)], {
    reminders: [3, 10, 20], viewed: true, reference: 'Folder 2026',
  });
  makeInvoice(ms, C['Bakkerij Hamstra'], n(32), addDays(today, -38), [line('Logo ontwerp', 1, 'stuk', 450)], {
    paidOn: addDays(today, -26), viewed: true, via: 'online',
  });
  const inv33 = makeInvoice(ms, C['Autobedrijf Kremer'], n(33), addDays(today, -25), [
    line('Website redesign – fase 1', 1, 'stuk', 1200),
    line('Website onderhoud', 4, 'uur', 75),
  ], { paidOn: addDays(today, -10), paidAmount: 900, viewed: true, via: 'bank' });
  const inv34 = makeInvoice(ms, C['De Leo Media'], n(34), addDays(today, -16), [
    line('Website redesign – fase 2', 1, 'stuk', 850),
    line('Website onderhoud', 2, 'uur', 75),
  ], { paidOn: today, viewed: true, via: 'bank', reference: 'PO-2291' });
  const inv35 = makeInvoice(ms, C['GymSupplies'], n(35), addDays(today, -14), [
    line('Grafisch ontwerp – productfotografie retouche', 8, 'uur', 65),
    line('Hosting', 1, 'jaar', 180),
  ], { viewed: true, state: 'viewed' });
  const pm = C['PM Agency'];
  const inv36 = makeInvoice(ms, pm, n(36), addDays(today, -13), [
    line('Social media templates', 1, 'stuk', 380),
    line('Grafisch ontwerp', 2, 'uur', 60),
  ], { reminders: [3], viewed: true, state: 'viewed' });
  const studio = C['Studio Noord'];
  const inv37 = makeInvoice(ms, studio, n(37), addDays(today, -3), [
    line('Ontwerp tentoonstellingsposters', 3, 'stuk', 110),
    line('Drukwerkbegeleiding', 0.5, 'uur', 40),
  ], { state: 'sent' });
  inv37.issueDate = monthStart > addDays(today, -3) ? monthStart : addDays(today, -3);
  inv37.dueDate = addDays(inv37.issueDate, 30);

  // Draft (no number yet — numbers are assigned when the invoice is finalised).
  const draft: Invoice = {
    id: id('inv'), organizationId: ms.id, kind: 'invoice', number: '', customerId: C['Gemeente Borger-Odoorn'].id,
    issueDate: today, dueDate: addDays(today, 30), reference: 'Inkoopordernummer 4500123', lines: [
      line('Campagnebeeld "Samen schoon"', 1, 'stuk', 1450),
      line('Advertenties regionale krant (3 formaten)', 3, 'stuk', 120),
      line('Drukwerkbegeleiding', 3, 'uur', 55),
    ], note: ms.defaultInvoiceNote, state: 'draft', payments: [], publicToken: publicToken(),
    remindersEnabled: true, remindersSent: [], createdAt: ts(today, 8),
  };
  b.invoices.push(draft);

  // Quotes
  const q = (customer: Customer, k: number, issue: string, lines: DocumentLine[], state: Quote['state'], extra: Partial<Quote> = {}): Quote => ({
    id: id('quo'), organizationId: ms.id, number: `OF-${year}-${String(k).padStart(3, '0')}`, customerId: customer.id,
    issueDate: issue, validUntil: addDays(issue, 30), reference: '', lines, note: 'Deze offerte is 30 dagen geldig. Prijzen zijn exclusief btw.',
    state, publicToken: publicToken(), sentAt: state !== 'draft' ? ts(issue, 11) : undefined, createdAt: ts(issue, 10), ...extra,
  });
  const msQuotes: Quote[] = [
    q(C['Gemeente Borger-Odoorn'], 13, addDays(today, -4), [
      line('Campagne "Veilig verkeer" – concept en ontwerp', 1, 'stuk', 2400),
      line('Uitwerking in 6 formaten', 6, 'stuk', 125),
      line('Drukwerkbegeleiding', 8, 'uur', 55),
    ], 'sent'),
    q(studio, 12, addDays(today, -21), [line('Ontwerp tentoonstellingsposters', 3, 'stuk', 110), line('Drukwerkbegeleiding', 0.5, 'uur', 40)], 'accepted', {
      respondedAt: ts(addDays(today, -19), 15), invoiceId: inv37.id,
    }),
    q(C['Bakkerij Hamstra'], 11, addDays(today, -1), [line('Verpakkingsontwerp broodzakken', 1, 'stuk', 680), line('Grafisch ontwerp', 4, 'uur', 65)], 'draft'),
    q(pm, 10, addDays(today, -52), [line('Huisstijlhandboek', 1, 'stuk', 950)], 'declined', { respondedAt: ts(addDays(today, -45), 10) }),
    q(C['Fysio Vlagtwedde'], 9, addDays(today, -70), [line('Website redesign', 1, 'stuk', 2200)], 'sent'),
  ];
  inv37.quoteId = msQuotes[1].id;

  // Recurring invoices
  const msRecurring: RecurringInvoice[] = [
    {
      id: id('rec'), organizationId: ms.id, name: 'Hosting & onderhoud', customerId: C['De Leo Media'].id,
      lines: [line('Hosting & onderhoudsbundel', 1, 'maand', 25)], frequency: 'monthly',
      startDate: addDays(today, -300), nextDate: toISODate(new Date(year, parseISODate(today).getMonth() + 1, 1)),
      autoCreate: true, autoSend: true, active: true, invoiceIds: [],
    },
    {
      id: id('rec'), organizationId: ms.id, name: 'Website onderhoud', customerId: C['GymSupplies'].id,
      lines: [line('Website onderhoud (strippenkaart)', 2, 'uur', 75)], frequency: 'quarterly',
      startDate: addDays(today, -200), nextDate: addDays(today, 24), autoCreate: true, autoSend: false, active: true, invoiceIds: [],
    },
    {
      id: id('rec'), organizationId: ms.id, name: 'Hosting', customerId: pm.id,
      lines: [line('Hosting', 1, 'jaar', 180), line('Domeinnaam', 2, 'jaar', 15)], frequency: 'yearly',
      startDate: addDays(today, -330), nextDate: addDays(today, 35), autoCreate: true, autoSend: true, active: true, invoiceIds: [],
    },
    {
      id: id('rec'), organizationId: ms.id, name: 'Social media pakket', customerId: C['Bakkerij Hamstra'].id,
      lines: [line('Social media posts (8 per maand)', 1, 'maand', 240)], frequency: 'monthly',
      startDate: addDays(today, -90), nextDate: addDays(today, 12), autoCreate: true, autoSend: false, active: false, invoiceIds: [],
    },
  ];

  // Suppliers (learned categories)
  const sup = (name: string, cat: string, vat: VatRate, iban = '', website = '', timesUsed = 6): Supplier => ({
    id: id('sup'), organizationId: ms.id, name, defaultCategory: cat, defaultVatRate: vat, iban, email: '', website, timesUsed,
  });
  const msSuppliers: Supplier[] = [
    sup('Adobe', 'Software', 21, 'IE29AIBK93115212345678', 'adobe.com', 12),
    sup('Cloud86', 'Hosting', 21, 'NL86INGB0002445588', 'cloud86.nl', 12),
    sup('KPN', 'Telefoon & internet', 21, 'NL27INGB0000026500', 'kpn.com', 12),
    sup('Canva', 'Software', 21, '', 'canva.com', 12),
    sup('Meta', 'Marketing', 21, '', 'facebook.com', 5),
    sup('Shell', 'Brandstof', 21, '', 'shell.nl', 9),
    sup('Praxis', 'Materiaal', 21, '', 'praxis.nl', 3),
    sup('Bol.com', 'Kantoor', 21, 'NL19ABNA0559862541', 'bol.com', 4),
    sup('NS', 'Reiskosten', 9, '', 'ns.nl', 3),
    sup('Centraal Beheer', 'Verzekeringen', 0, '', 'centraalbeheer.nl', 4),
    sup('ING', 'Bankkosten', 0, '', 'ing.nl', 12),
  ];

  // Expenses, last 15 months
  const expense = (
    org: Organization, supplierName: string, date: string, total: number, vatRate: VatRate, category: string,
    kind: Expense['kind'], extra: Partial<Expense> = {},
  ): Expense => {
    const { base, vat } = splitVat(total, vatRate);
    const e: Expense = {
      id: id('exp'), organizationId: org.id, kind, supplierName, invoiceNumber: kind === 'invoice' ? `${supplierName.slice(0, 3).toUpperCase()}-${date.replace(/-/g, '').slice(2)}` : '',
      date, subtotal: base, vatAmount: vat, total, vatRate, category, description: '', iban: '', status: 'processed', paid: true,
      source: kind === 'invoice' ? 'email' : 'camera', document: { fileName: `${supplierName.replace(/\W/g, '')}-${date}.${kind === 'invoice' ? 'pdf' : 'jpg'}`, mimeType: kind === 'invoice' ? 'application/pdf' : 'image/jpeg' },
      createdAt: ts(date, 18), ...extra,
    };
    b.expenses.push(e);
    return e;
  };
  for (let m = 14; m >= 0; m--) {
    const d = (day: number) => {
      const dt = new Date(year, parseISODate(today).getMonth() - m, day);
      return toISODate(dt);
    };
    const inPast = (date: string) => date <= today;
    if (inPast(d(3)) && m > 0) expense(ms, 'Adobe', d(3), 72.59, 21, 'Software', 'invoice', { description: 'Creative Cloud – alle apps' });
    if (inPast(d(1))) expense(ms, 'Cloud86', d(1), 24.95, 21, 'Hosting', 'invoice', { description: 'Resellerhosting' });
    if (inPast(d(2))) expense(ms, 'KPN', d(2), 63.95, 21, 'Telefoon & internet', 'invoice', { description: 'Zakelijk mobiel + glasvezel' });
    if (inPast(d(9))) expense(ms, 'Canva', d(9), 11.99, 21, 'Software', 'invoice', { description: 'Canva Pro' });
    if (inPast(d(28))) expense(ms, 'ING', d(28), 9.75, 0, 'Bankkosten', 'invoice', { description: 'Kosten zakelijke rekening' });
    if (inPast(d(12)) && m !== 0) expense(ms, 'Shell', d(12), round2(58 + rand() * 30), 21, 'Brandstof', 'receipt');
    if (inPast(d(19)) && rand() > 0.4) expense(ms, 'Meta', d(19), round2(40 + rand() * 120), 21, 'Marketing', 'invoice', { description: 'Advertenties Facebook & Instagram' });
    if (inPast(d(22)) && rand() > 0.55) expense(ms, 'Bol.com', d(22), round2(19 + rand() * 90), 21, 'Kantoor', 'invoice', { description: 'Kantoorartikelen' });
    if (inPast(d(16)) && rand() > 0.6) expense(ms, 'NS', d(16), round2(18 + rand() * 30), 9, 'Reiskosten', 'receipt', { description: 'Treinreis klantbezoek' });
    if (inPast(d(5)) && m % 3 === 0 && m > 0) expense(ms, 'Centraal Beheer', d(5), 89.4, 0, 'Verzekeringen', 'invoice', { description: 'Beroeps- en bedrijfsaansprakelijkheid' });
  }
  // Current month extras: two items still to check.
  const praxis = expense(ms, 'Praxis', addDays(today, 0), 52.89, 21, 'Materiaal', 'receipt', {
    status: 'review', description: 'Bevestigingsmateriaal en tape', source: 'camera', document: { fileName: 'bon-praxis.jpg', mimeType: 'image/jpeg' },
  });
  praxis.vatAmount = 9.18;
  praxis.subtotal = 43.71;
  const adobeNow = expense(ms, 'Adobe', addDays(today, -1), 72.59, 21, 'Software', 'invoice', {
    status: 'review', paid: true, source: 'email', description: 'Creative Cloud – alle apps', invoiceNumber: 'IEN2026004417',
    document: { fileName: 'Adobe_Invoice_IEN2026004417.pdf', mimeType: 'application/pdf' }, iban: 'IE29AIBK93115212345678',
  });

  // Bank
  const ing = {
    id: id('acc'), organizationId: ms.id, bankName: 'ING', name: 'ING Zakelijk', iban: 'NL00INGB0123456789',
    balance: 8420.55, provider: 'demo' as const, connectedAt: ts(addDays(today, -120)), lastSyncAt: new Date().toISOString(),
    consentValidUntil: addDays(today, 60), color: '#FF6200',
  };
  const savings = {
    id: id('acc'), organizationId: ms.id, bankName: 'ING', name: 'Zakelijke spaarrekening', iban: 'NL00INGB0987654321',
    balance: 12500, provider: 'demo' as const, connectedAt: ts(addDays(today, -120)), lastSyncAt: new Date().toISOString(),
    consentValidUntil: addDays(today, 60), color: '#1F2A44',
  };
  const tx = (date: string, counterparty: string, amount: number, description: string, extra: Partial<BankTransaction> = {}, iban = '') => {
    const t: BankTransaction = {
      id: id('tx'), organizationId: ms.id, accountId: ing.id, date, description, counterparty, counterpartyIban: iban, amount, status: 'todo', ...extra,
    };
    b.transactions.push(t);
    return t;
  };
  const from = addDays(today, -60);
  // Incoming payments for paid invoices in the window
  for (const inv of b.invoices) {
    if (inv.organizationId !== ms.id) continue;
    for (const p of inv.payments) {
      if (p.date < from || p.source === 'manual') continue;
      const cust = msCustomers.find((c) => c.id === inv.customerId)!;
      const t = tx(p.date, cust.companyName, p.amount, p.source === 'online' ? `Mollie betaling ${inv.number} iDEAL` : `Factuur ${inv.number}`, {
        status: 'matched', invoiceId: inv.id, confidence: 100, autoMatched: true,
      }, p.source === 'online' ? 'NL70DEUT0265186439' : cust.iban);
      if (p.source === 'online') t.counterparty = 'Stichting Mollie Payments';
      p.transactionId = t.id;
    }
  }
  for (const e of b.expenses) {
    if (e.organizationId !== ms.id || e.date < from || e.status === 'review') continue;
    const t = tx(e.date, e.supplierName, -e.total, e.description || e.supplierName, { status: 'matched', expenseId: e.id, confidence: 100, autoMatched: true });
    e.transactionId = t.id;
  }
  // Things that still need attention
  tx(today, studio.companyName, 423.5, 'Betaling posters tentoonstelling', { status: 'suggested', invoiceId: inv37.id, confidence: 70 }, studio.iban);
  tx(addDays(today, -1), 'Adobe Systems Software Ireland', -72.59, 'ADOBE *CREATIVE CLOUD IEN2026004417', { status: 'suggested', expenseId: adobeNow.id, confidence: 90 });
  tx(addDays(today, -2), 'Albert Heijn 1427', -18.4, 'Betaalautomaat AH Veendam');
  tx(addDays(today, -3), 'Q-Park Groningen', -6.4, 'Parkeren Ossenmarkt');
  tx(addDays(today, -4), 'Bol.com', -34.99, 'Bestelling 4012231188');
  tx(addDays(today, -6), 'KPN B.V.', -63.95, 'KPN zakelijk factuur', { status: 'categorized', category: 'Telefoon & internet' });
  tx(addDays(today, -20), 'Belastingdienst', -712, 'Btw-aangifte kwartaal', { status: 'categorized', category: 'Belastingen' });

  const msNotifications: AppNotification[] = [
    { id: id('ntf'), organizationId: ms.id, kind: 'paid', title: `Factuur ${inv34.number} is betaald.`, body: 'De Leo Media betaalde € 1.210,00 via de bank.', href: `/facturen/${inv34.id}`, createdAt: new Date(Date.now() - 1000 * 60 * 42).toISOString(), read: false },
    { id: id('ntf'), organizationId: ms.id, kind: 'expense', title: 'Nieuwe inkoopfactuur van Adobe ontvangen.', body: 'Via je inbox-adres. Klaar om te controleren.', href: '/inkoopfacturen', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(), read: false },
    { id: id('ntf'), organizationId: ms.id, kind: 'overdue', title: `Factuur ${inv36.number} is verlopen.`, body: 'PM Agency heeft nog niet betaald. De eerste herinnering is verstuurd.', href: `/facturen/${inv36.id}`, createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(), read: false },
    { id: id('ntf'), organizationId: ms.id, kind: 'receipt', title: 'Bon van Praxis is uitgelezen.', body: 'Controleer even of alles klopt.', href: '/bonnetjes', createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(), read: false },
    { id: id('ntf'), organizationId: ms.id, kind: 'bank', title: '5 transacties moeten worden gecontroleerd.', href: '/bank', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), read: true },
    { id: id('ntf'), organizationId: ms.id, kind: 'quote', title: `Offerte ${msQuotes[1].number} is geaccepteerd.`, body: 'Studio Noord heeft de offerte online geaccepteerd.', href: `/offertes/${msQuotes[1].id}`, createdAt: ts(addDays(today, -19), 15), read: true },
  ];
  void inv33; void inv35;

  /* ───────────────────────── V&Z Veendam ───────────────────────── */
  const vz: Organization = {
    ...blankOrganization('org_vz', 'V&Z Veendam', year),
    kind: 'association',
    name: 'V&Z Veendam',
    tradeName: 'Volleybalvereniging V&Z Veendam',
    initials: 'VZ',
    address: 'Sportlaan 2',
    postalCode: '9645 AB',
    city: 'Veendam',
    kvk: '40123456',
    vatNumber: '',
    vatRegistered: false,
    defaultVatRate: 0,
    iban: 'NL00RABO0123456789',
    bic: 'RABONL2U',
    email: 'penningmeester@vzveendam.nl',
    phone: '06 98 76 54 32',
    website: 'vzveendam.nl',
    accentColor: '#525252',
    invoicePrefix: `VZ-${year}-`,
    nextInvoiceNumber: 22,
    quotePrefix: `VZ-OF-${year}-`,
    nextQuoteNumber: 1,
    paymentTermDays: 30,
    defaultInvoiceNote: 'Bedankt voor je steun aan V&Z Veendam!',
    inboxAddress: 'vzveendam-Q8MD@inbox.brenqo.nl',
    payments: { provider: 'mollie', connected: true, payLinkOnInvoice: true, payButtonInEmail: true, methods: { ideal: true, bancontact: false, creditcard: false, banktransfer: true } },
  };
  const people = [
    'Femke de Boer', 'Johan Kuipers', 'Sanne Hofman', 'Rick Smit', 'Lotte Veenstra', 'Bas Hiemstra', 'Iris Wolters',
    'Daan Huizinga', 'Noor Bosma', 'Thijs Dijkstra', 'Anouk Zuidema', 'Jesse Pol', 'Maud Kroeze', 'Ruben Brink',
    'Fleur Wiersma', 'Stijn Oosting',
  ];
  const vzMembers: Customer[] = people.map((name, i) => ({
    id: id('cus'), organizationId: vz.id, companyName: name, contactName: name.split(' ')[0],
    email: `${name.toLowerCase().replace(/\s+/g, '.').replace('de.', 'de')}@gmail.com`, phone: '', address: `Molenstreek ${i * 3 + 2}`,
    postalCode: '9641 B' + String.fromCharCode(65 + (i % 20)), city: 'Veendam', country: 'Nederland', kvk: '', vatNumber: '', iban: '',
    paymentTermDays: 30, defaultInvoiceText: '', remindersEnabled: true, tags: ['Lid'], createdAt: ts(addDays(today, -500)),
  }));
  const sponsorsRaw: [string, string, number][] = [
    ['Bouwbedrijf Hadders', 'Gert Hadders', 750], ['Autoschade Veendam', 'Monique Lubbers', 500], ['Café De Toekomst', 'Karin Bakker', 350],
    ['Installatiebedrijf Wubs', 'Erik Wubs', 500], ['Bakkerij Ter Veen', 'Albert ter Veen', 250],
  ];
  const vzSponsors: Customer[] = sponsorsRaw.map(([name, contact], i) => ({
    id: id('cus'), organizationId: vz.id, companyName: name, contactName: contact,
    email: `info@${name.toLowerCase().replace(/[^a-z]/g, '')}.nl`, phone: '0598 ' + (620000 + i * 1111), address: `Industrieweg ${10 + i}`,
    postalCode: '9641 KC', city: 'Veendam', country: 'Nederland', kvk: String(70000000 + i * 4321), vatNumber: '', iban: '',
    paymentTermDays: 30, defaultInvoiceText: '', remindersEnabled: true, tags: ['Sponsor'], createdAt: ts(addDays(today, -600)),
  }));
  const seasonStart = addDays(today, -35);
  let vzN = 1;
  const vzn = () => `VZ-${year}-${String(vzN++).padStart(3, '0')}`;
  const season = `${year}/${year + 1}`;
  vzSponsors.forEach((s, i) => {
    const amount = sponsorsRaw[i][2];
    makeInvoice(vz, s, vzn(), addDays(seasonStart, -10), [line(`Sponsorpakket seizoen ${season}`, 1, 'stuk', amount, 0)], {
      paidOn: i < 3 ? addDays(seasonStart, 5 + i * 3) : undefined, viewed: true, reminders: i < 3 ? [] : [3, 10],
    });
  });
  vzMembers.slice(0, 16).forEach((m, i) => {
    const paid = i < 11;
    makeInvoice(vz, m, vzn(), seasonStart, [line(`Contributie seizoen ${season}`, 1, 'seizoen', 150, 0)], {
      paidOn: paid ? addDays(seasonStart, 2 + i) : undefined, viewed: i % 3 !== 0, reminders: paid ? [] : [3],
      state: !paid && i % 3 === 0 ? 'sent' : undefined,
    });
  });
  const vzSuppliers: Supplier[] = [
    { id: id('sup'), organizationId: vz.id, name: 'Gemeente Veendam (sporthal)', defaultCategory: 'Zaalhuur', defaultVatRate: 0, iban: '', email: '', website: '', timesUsed: 4 },
    { id: id('sup'), organizationId: vz.id, name: 'Sporthuis Veendam', defaultCategory: 'Materiaal', defaultVatRate: 21, iban: '', email: '', website: '', timesUsed: 3 },
    { id: id('sup'), organizationId: vz.id, name: 'Makro', defaultCategory: 'Kantine', defaultVatRate: 9, iban: '', email: '', website: '', timesUsed: 5 },
    { id: id('sup'), organizationId: vz.id, name: 'Nevobo', defaultCategory: 'Bondskosten', defaultVatRate: 0, iban: '', email: '', website: '', timesUsed: 2 },
  ];
  for (let m = 8; m >= 0; m--) {
    const d = (day: number) => toISODate(new Date(year, parseISODate(today).getMonth() - m, day));
    if (d(4) <= today) expense(vz, 'Gemeente Veendam (sporthal)', d(4), 410, 0, 'Zaalhuur', 'invoice', { description: 'Zaalhuur sporthal De Dijk' });
    if (d(14) <= today && m % 2 === 0) expense(vz, 'Makro', d(14), round2(120 + rand() * 180), 9, 'Kantine', 'receipt', { description: 'Inkoop kantine' });
  }
  expense(vz, 'Sporthuis Veendam', addDays(today, -26), 389.0, 21, 'Materiaal', 'receipt', { description: '12 wedstrijdballen + ballenwagen' });
  expense(vz, 'Nevobo', addDays(today, -30), 1240, 0, 'Bondskosten', 'invoice', { description: 'Teamcontributie en scheidsrechterskosten' });
  expense(vz, 'Makro', addDays(today, -1), 86.4, 9, 'Kantine', 'receipt', { status: 'review', description: 'Frisdrank en snoep' });

  const rabo = {
    id: id('acc'), organizationId: vz.id, bankName: 'Rabobank', name: 'Rabobank Verenigingsrekening', iban: 'NL00RABO0123456789',
    balance: 6312.4, provider: 'demo' as const, connectedAt: ts(addDays(today, -90)), lastSyncAt: new Date().toISOString(),
    consentValidUntil: addDays(today, 90), color: '#000099',
  };
  for (const inv of b.invoices) {
    if (inv.organizationId !== vz.id) continue;
    for (const p of inv.payments) {
      const cust = [...vzMembers, ...vzSponsors].find((c) => c.id === inv.customerId)!;
      const t: BankTransaction = {
        id: id('tx'), organizationId: vz.id, accountId: rabo.id, date: p.date, description: p.source === 'online' ? `Mollie ${inv.number}` : `Contributie ${inv.number}`,
        counterparty: p.source === 'online' ? 'Stichting Mollie Payments' : cust.companyName, counterpartyIban: '', amount: p.amount, status: 'matched',
        invoiceId: inv.id, confidence: 100, autoMatched: true,
      };
      p.transactionId = t.id;
      b.transactions.push(t);
    }
  }
  b.transactions.push(
    { id: id('tx'), organizationId: vz.id, accountId: rabo.id, date: addDays(today, -2), description: 'Contributie', counterparty: 'R. Brink', counterpartyIban: 'NL11INGB0001234567', amount: 150, status: 'todo' },
    { id: id('tx'), organizationId: vz.id, accountId: rabo.id, date: addDays(today, -1), description: 'Makro Groningen', counterparty: 'Makro', counterpartyIban: '', amount: -86.4, status: 'todo' },
  );
  const vzNotifications: AppNotification[] = [
    { id: id('ntf'), organizationId: vz.id, kind: 'paid', title: '11 van 16 leden hebben hun contributie betaald.', href: '/facturen', createdAt: ts(addDays(today, -1), 9), read: false },
    { id: id('ntf'), organizationId: vz.id, kind: 'receipt', title: 'Bon van Makro is uitgelezen.', href: '/bonnetjes', createdAt: ts(addDays(today, -1), 19), read: false },
  ];

  return {
    user: { id: 'usr_glenn', name: 'Glenn Mulder', email: 'glenn@muldersign.nl', initials: 'GM' },
    activeOrgId: ms.id,
    organizations: [ms, vz],
    members: [
      { id: id('mem'), organizationId: ms.id, name: 'Glenn Mulder', email: 'glenn@muldersign.nl', role: 'owner' },
      { id: id('mem'), organizationId: ms.id, name: 'Boekhouder (alleen lezen)', email: 'administratie@kantoorveendam.nl', role: 'viewer' },
      { id: id('mem'), organizationId: vz.id, name: 'Glenn Mulder', email: 'glenn@muldersign.nl', role: 'owner' },
      { id: id('mem'), organizationId: vz.id, name: 'Femke de Boer', email: 'voorzitter@vzveendam.nl', role: 'admin' },
    ],
    customers: [...msCustomers, ...vzMembers, ...vzSponsors],
    suppliers: [...msSuppliers, ...vzSuppliers],
    products: [
      ...msProducts,
      { id: id('prd'), organizationId: vz.id, name: `Contributie seizoen ${season}`, description: 'Lidmaatschap inclusief competitie', price: 150, vatRate: 0, unit: 'seizoen' },
      { id: id('prd'), organizationId: vz.id, name: 'Contributie jeugd', description: 'Lidmaatschap t/m 17 jaar', price: 95, vatRate: 0, unit: 'seizoen' },
      { id: id('prd'), organizationId: vz.id, name: 'Sponsorpakket Brons', description: 'Naam op website en bord in de zaal', price: 250, vatRate: 0, unit: 'seizoen' },
      { id: id('prd'), organizationId: vz.id, name: 'Sponsorpakket Zilver', description: 'Brons + logo op wedstrijdshirts', price: 500, vatRate: 0, unit: 'seizoen' },
      { id: id('prd'), organizationId: vz.id, name: 'Sponsorpakket Goud', description: 'Zilver + hoofdsponsor toernooi', price: 750, vatRate: 0, unit: 'seizoen' },
    ],
    invoices: b.invoices,
    quotes: msQuotes,
    categories: [...categoriesFor(ms.id), ...categoriesFor(vz.id, ['Zaalhuur', 'Kantine', 'Bondskosten'])],
    expenses: b.expenses,
    bankAccounts: [ing, savings, rabo],
    transactions: b.transactions,
    recurring: msRecurring,
    notifications: [...msNotifications, ...vzNotifications],
    emailLogs: b.emailLogs,
    automationsRanOn: today,
  };
}

export function emptyOrgCategories(orgId: string): Category[] {
  return DEFAULT_CATEGORIES.map((c) => ({ id: uid('cat'), organizationId: orgId, name: c.name, icon: c.icon, custom: false }));
}
