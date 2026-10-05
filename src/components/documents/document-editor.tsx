'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Eye, Send, Save, Pencil, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { useCustomers, useOrg, useStore } from '@/lib/store';
import { useUI } from '@/lib/store/ui';
import type { DocumentLine } from '@/lib/types';
import { documentTotals } from '@/lib/domain/calc';
import { formatEUR } from '@/lib/domain/money';
import { addDays, todayISO } from '@/lib/domain/dates';
import { formatDocNumber } from '@/lib/domain/numbering';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Segmented } from '@/components/ui/misc';
import { CustomerPicker } from './customer-picker';
import { LinesEditor, newLine } from './lines-editor';
import { InvoiceDocument } from './invoice-document';
import { cn } from '@/lib/utils';

export interface EditorInitial {
  id?: string;
  customerId: string;
  issueDate: string;
  dueDate: string;
  reference: string;
  lines: DocumentLine[];
  note: string;
  number?: string;
}

export function DocumentEditor({ mode, initial }: { mode: 'invoice' | 'quote'; initial?: Partial<EditorInitial> }) {
  const org = useOrg();
  const customers = useCustomers();
  const router = useRouter();
  const setUI = useUI((s) => s.set);
  const saveInvoice = useStore((s) => s.saveInvoice);
  const saveQuote = useStore((s) => s.saveQuote);
  const today = todayISO();
  const [form, setForm] = useState<EditorInitial>(() => ({
    customerId: '',
    issueDate: today,
    dueDate: addDays(today, mode === 'quote' ? org.quoteValidDays : org.paymentTermDays),
    reference: '',
    lines: [newLine(org.defaultVatRate)],
    note: mode === 'quote' ? `Deze offerte is ${org.quoteValidDays} dagen geldig.` : org.defaultInvoiceNote,
    ...initial,
  }));
  const [view, setView] = useState<'edit' | 'preview'>('edit');
  const [showMore, setShowMore] = useState(!!initial?.reference);
  const customer = customers.find((c) => c.id === form.customerId);
  const totals = useMemo(() => documentTotals(form.lines), [form.lines]);
  const set = (patch: Partial<EditorInitial>) => setForm((f) => ({ ...f, ...patch }));
  const label = mode === 'invoice' ? 'factuur' : 'offerte';

  // Pick up a customer that was just created from the drawer.
  const lastCustomer = customers[customers.length - 1];
  const [seenCount, setSeenCount] = useState(customers.length);
  useEffect(() => {
    if (customers.length > seenCount && lastCustomer) {
      set({ customerId: lastCustomer.id });
    }
    setSeenCount(customers.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers.length]);

  // Customer defaults: payment term and default invoice text.
  function chooseCustomer(id: string) {
    const c = customers.find((x) => x.id === id);
    if (!c) return;
    setForm((f) => ({
      ...f,
      customerId: id,
      dueDate: mode === 'invoice' ? addDays(f.issueDate, c.paymentTermDays) : f.dueDate,
      note: c.defaultInvoiceText && mode === 'invoice' ? c.defaultInvoiceText : f.note,
    }));
  }

  function validate() {
    if (!form.customerId) { toast.error('Kies eerst een klant'); return false; }
    if (!form.lines.some((l) => l.description.trim())) { toast.error('Voeg minimaal één regel met een omschrijving toe'); return false; }
    return true;
  }

  function persist() {
    const lines = form.lines.filter((l) => l.description.trim() || l.unitPrice);
    if (mode === 'invoice') {
      return saveInvoice({ id: form.id, customerId: form.customerId, issueDate: form.issueDate, dueDate: form.dueDate, reference: form.reference, lines, note: form.note });
    }
    return saveQuote({ id: form.id, customerId: form.customerId, issueDate: form.issueDate, validUntil: form.dueDate, reference: form.reference, lines, note: form.note });
  }

  function saveDraft() {
    if (!validate()) return;
    const id = persist();
    toast.success(mode === 'invoice' ? 'Factuur opgeslagen als concept' : 'Offerte opgeslagen');
    router.push(`/${mode === 'invoice' ? 'facturen' : 'offertes'}/${id}`);
  }

  function saveAndSend() {
    if (!validate()) return;
    const id = persist();
    router.push(`/${mode === 'invoice' ? 'facturen' : 'offertes'}/${id}`);
    setTimeout(() => setUI(mode === 'invoice' ? { sendInvoiceId: id } : { sendQuoteId: id }), 250);
  }

  const number = form.number || (mode === 'invoice' ? formatDocNumber(org.invoicePrefix, org.nextInvoiceNumber) : formatDocNumber(org.quotePrefix, org.nextQuoteNumber));

  const preview = (
    <InvoiceDocument
      org={org}
      customer={customer}
      doc={{ kind: mode === 'quote' ? 'quote' : 'invoice', number: mode === 'invoice' && !form.number ? '' : number, issueDate: form.issueDate, dueDate: form.dueDate, reference: form.reference, lines: form.lines, note: form.note }}
      className="rounded-[18px] shadow-raised ring-1 ring-line"
    />
  );

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild><Link href={mode === 'invoice' ? '/facturen' : '/offertes'} aria-label="Terug"><ArrowLeft className="!size-5" /></Link></Button>
          <div>
            <h1 className="font-display text-[22px] font-bold sm:text-[26px]">{form.id ? `${mode === 'invoice' ? 'Factuur' : 'Offerte'} bewerken` : `Nieuwe ${label}`}</h1>
            <p className="text-[13px] text-muted">{mode === 'invoice' && !form.number ? `Krijgt nummer ${number} zodra je hem verstuurt` : number}</p>
          </div>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <Button variant="outline" onClick={saveDraft}><Save /> Opslaan als concept</Button>
          <Button onClick={saveAndSend}><Send /> Opslaan en versturen</Button>
        </div>
      </div>

      <div className="mb-4 xl:hidden">
        <Segmented value={view} onChange={setView} options={[{ value: 'edit', label: <><Pencil className="size-3.5" /> Bewerken</> }, { value: 'preview', label: <><Eye className="size-3.5" /> Voorbeeld</> }]} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,560px)]">
        <div className={cn('space-y-4', view === 'preview' && 'hidden xl:block')}>
          <Card className="p-5 sm:p-6">
            <div className="mb-3 text-[13px] font-semibold text-ink-2">{mode === 'invoice' ? 'Aan wie stuur je de factuur?' : 'Voor wie is de offerte?'}</div>
            <CustomerPicker value={form.customerId} onChange={chooseCustomer} />
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Field label={mode === 'invoice' ? 'Factuurdatum' : 'Offertedatum'}>
                <Input type="date" value={form.issueDate} onChange={(e) => {
                  const term = mode === 'invoice' ? customer?.paymentTermDays ?? org.paymentTermDays : org.quoteValidDays;
                  set({ issueDate: e.target.value, dueDate: addDays(e.target.value, term) });
                }} />
              </Field>
              <Field label={mode === 'invoice' ? 'Vervaldatum' : 'Geldig tot'}>
                <Input type="date" value={form.dueDate} onChange={(e) => set({ dueDate: e.target.value })} />
              </Field>
            </div>
            {mode === 'invoice' && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[7, 14, 30].map((d) => (
                  <button key={d} type="button" onClick={() => set({ dueDate: addDays(form.issueDate, d) })} className={cn('rounded-full px-2.5 py-1 text-[12px] font-medium ring-1 ring-inset transition', form.dueDate === addDays(form.issueDate, d) ? 'bg-brand-50 text-brand-700 ring-brand-100' : 'text-muted ring-line hover:text-ink')}>
                    {d} dagen
                  </button>
                ))}
              </div>
            )}
            <button type="button" onClick={() => setShowMore((v) => !v)} className="mt-4 flex items-center gap-1 text-[13px] font-medium text-muted hover:text-ink">
              <ChevronDown className={cn('size-4 transition', showMore && 'rotate-180')} /> Referentie / kenmerk
            </button>
            {showMore && (
              <Field label="Referentie of kenmerk" className="mt-3" hint="Bijvoorbeeld een inkoopordernummer van je klant.">
                <Input value={form.reference} onChange={(e) => set({ reference: e.target.value })} placeholder="PO-12345" />
              </Field>
            )}
          </Card>

          <Card className="p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-[13px] font-semibold text-ink-2">Wat heb je geleverd?</div>
              <span className="text-[12px] text-faint">Typ om producten te zoeken</span>
            </div>
            <LinesEditor lines={form.lines} onChange={(lines) => set({ lines })} showVat={org.vatRegistered} />
            <div className="mt-6 flex justify-end border-t border-line pt-5">
              <dl className="w-full max-w-[280px] space-y-2 text-[14px]">
                <div className="flex justify-between"><dt className="text-muted">Subtotaal</dt><dd className="tabular">{formatEUR(totals.subtotal)}</dd></div>
                {totals.discount > 0 && <div className="flex justify-between text-success-600"><dt>Korting</dt><dd className="tabular">− {formatEUR(totals.discount)}</dd></div>}
                {org.vatRegistered && totals.vatByRate.map((r) => (
                  <div key={r.rate} className="flex justify-between"><dt className="text-muted">Btw {r.rate}%</dt><dd className="tabular">{formatEUR(r.vat)}</dd></div>
                ))}
                <div className="flex items-baseline justify-between border-t border-line pt-3">
                  <dt className="font-semibold">Totaal</dt>
                  <dd className="tabular font-display text-[24px] font-bold tracking-[-0.02em]">{formatEUR(totals.total)}</dd>
                </div>
              </dl>
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <Field label="Notitie op de factuur" optional hint="Komt onderaan de factuur te staan.">
              <Textarea value={form.note} onChange={(e) => set({ note: e.target.value })} className="min-h-[80px]" />
            </Field>
          </Card>
        </div>

        <div className={cn(view === 'edit' && 'hidden xl:block')}>
          <div className="xl:sticky xl:top-24">
            <div className="mb-2 hidden items-center justify-between text-[12.5px] text-muted xl:flex">
              <span className="flex items-center gap-1.5"><Eye className="size-3.5" /> Live voorbeeld</span>
              <span>Zo ziet je klant het</span>
            </div>
            <div className="origin-top xl:max-h-[calc(100dvh-140px)] xl:overflow-y-auto xl:rounded-[18px] scrollbar-none">{preview}</div>
          </div>
        </div>
      </div>

      {/* Mobile action bar */}
      <div className="fixed inset-x-0 bottom-[calc(62px+env(safe-area-inset-bottom))] z-30 border-t border-line bg-white/95 px-4 py-3 backdrop-blur sm:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[11.5px] text-muted">Totaal</div>
            <div className="tabular font-display text-[18px] font-bold">{formatEUR(totals.total)}</div>
          </div>
          <Button variant="outline" size="icon" onClick={saveDraft} aria-label="Opslaan als concept"><Save /></Button>
          <Button onClick={saveAndSend}><Send /> Versturen</Button>
        </div>
      </div>
    </div>
  );
}
