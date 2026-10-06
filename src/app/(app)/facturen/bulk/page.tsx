'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowLeft, Layers, Send, Check, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useCustomers, useOrg, useStore } from '@/lib/store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { Avatar, Checkbox, SearchField, Segmented } from '@/components/ui/misc';
import { addDays, todayISO } from '@/lib/domain/dates';
import { formatEUR, parseAmount, round2 } from '@/lib/domain/money';
import { formatDocNumber } from '@/lib/domain/numbering';
import { invoiceEmail } from '@/lib/emails';
import { deliverEmail, publicUrl } from '@/lib/services/email';
import { normalize, pluralize, uid, cn } from '@/lib/utils';
import type { VatRate } from '@/lib/types';

export default function BulkInvoicePage() {
  const org = useOrg();
  const customers = useCustomers();
  const products = useStore((s) => s.products.filter((p) => p.organizationId === s.activeOrgId));
  const bulkCreate = useStore((s) => s.bulkCreateInvoices);
  const tags = useMemo(() => [...new Set(customers.flatMap((c) => c.tags))], [customers]);
  const [tag, setTag] = useState('all');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const season = `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`;
  const [desc, setDesc] = useState(org.kind === 'association' ? `Contributie seizoen ${season}` : '');
  const [amount, setAmount] = useState(org.kind === 'association' ? '150' : '');
  const [vat, setVat] = useState<VatRate>(org.defaultVatRate);
  const [reference, setReference] = useState('');
  const [issueDate, setIssueDate] = useState(todayISO());
  const [term, setTerm] = useState(String(org.paymentTermDays));
  const [created, setCreated] = useState<string[] | null>(null);
  const [sending, setSending] = useState(false);

  const visible = customers.filter((c) => (tag === 'all' || c.tags.includes(tag)) && (!q || normalize(c.companyName).includes(normalize(q))));
  const price = parseAmount(amount);
  const each = round2(price * (1 + (org.vatRegistered ? vat : 0) / 100));
  const count = selected.size;

  function create() {
    if (!desc.trim() || price <= 0 || count === 0) return;
    const ids = bulkCreate({
      customerIds: [...selected],
      lines: [{ id: uid('ln'), description: desc, quantity: 1, unit: org.kind === 'association' ? 'seizoen' : 'stuk', unitPrice: price, vatRate: org.vatRegistered ? vat : 0, discountPct: 0 }],
      reference, issueDate, dueDate: addDays(issueDate, Number(term) || 14), note: org.defaultInvoiceNote,
    });
    setCreated(ids);
    toast.success(`${pluralize(ids.length, 'factuur', 'facturen')} gemaakt`, { description: 'Iedereen heeft een eigen factuurnummer gekregen.' });
  }

  async function sendAll() {
    if (!created) return;
    setSending(true);
    const s = useStore.getState();
    for (const id of created) {
      const inv = s.invoices.find((x) => x.id === id) ?? useStore.getState().invoices.find((x) => x.id === id)!;
      const customer = s.customers.find((c) => c.id === inv.customerId);
      const mail = invoiceEmail(org, customer, inv);
      if (!mail.to) continue;
      await deliverEmail({ ...mail, fromName: org.name, action: { label: 'Bekijk en betaal', url: publicUrl(`/f/${inv.publicToken}`) } });
      useStore.getState().sendInvoice(id, mail);
    }
    setSending(false);
    toast.success(`${pluralize(created.length, 'factuur', 'facturen')} verstuurd`, { description: 'We houden bij wie er betaald heeft en sturen automatisch herinneringen.' });
    setCreated(null);
    setSelected(new Set());
  }

  if (created) {
    const s = useStore.getState();
    const first = s.invoices.find((x) => x.id === created[0]);
    const last = s.invoices.find((x) => x.id === created[created.length - 1]);
    return (
      <div className="mx-auto max-w-xl animate-fade-in py-10 text-center">
        <div className="mx-auto grid size-20 animate-pop place-items-center rounded-full bg-success-50"><div className="grid size-14 place-items-center rounded-full bg-success-500 text-white"><Check className="size-7" strokeWidth={3} /></div></div>
        <h1 className="mt-6 font-display text-[26px] font-semibold">{pluralize(created.length, 'factuur', 'facturen')} klaar</h1>
        <p className="mt-2 text-[15px] text-muted">Nummers {first?.number} t/m {last?.number}. Wil je ze nu allemaal in één keer versturen?</p>
        <div className="mt-8 flex flex-col justify-center gap-2.5 sm:flex-row">
          <Button size="lg" onClick={sendAll} loading={sending}><Send /> Verstuur alle {created.length}</Button>
          <Button size="lg" variant="outline" asChild><Link href="/facturen?filter=open">Later versturen</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild><Link href="/facturen" aria-label="Terug"><ArrowLeft className="!size-5" /></Link></Button>
        <div>
          <h1 className="font-display text-[24px] font-semibold sm:text-[28px]">Meerdere facturen tegelijk</h1>
          <p className="text-[14px] text-muted">{org.kind === 'association' ? 'Handig voor contributie, sponsoring of deelnemersbijdragen.' : 'Dezelfde factuur voor meerdere klanten, ieder met een eigen nummer.'}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
            <Segmented value={tag} onChange={(v) => setTag(v)} options={[{ value: 'all', label: 'Iedereen', count: customers.length }, ...tags.map((t) => ({ value: t, label: t, count: customers.filter((c) => c.tags.includes(t)).length }))]} />
            <SearchField value={q} onChange={setQ} placeholder="Zoek relatie" className="sm:w-[240px]" />
          </div>
          <label className="flex cursor-pointer items-center gap-3 border-b border-line bg-subtle/60 px-5 py-2.5 text-[13px] font-medium text-muted">
            <Checkbox checked={visible.length > 0 && visible.every((c) => selected.has(c.id)) ? true : visible.some((c) => selected.has(c.id)) ? 'indeterminate' : false} onCheckedChange={(v) => setSelected((s) => { const n = new Set(s); visible.forEach((c) => (v ? n.add(c.id) : n.delete(c.id))); return n; })} />
            Selecteer alle {visible.length}
          </label>
          <ul className="max-h-[560px] overflow-y-auto">
            {visible.map((c) => (
              <li key={c.id}>
                <label className={cn('flex cursor-pointer items-center gap-3 border-b border-line/70 px-5 py-3 transition hover:bg-subtle/70', selected.has(c.id) && 'bg-brand-50/40')}>
                  <Checkbox checked={selected.has(c.id)} onCheckedChange={(v) => setSelected((s) => { const n = new Set(s); if (v) n.add(c.id); else n.delete(c.id); return n; })} />
                  <Avatar name={c.companyName} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-medium">{c.companyName}</div>
                    <div className="truncate text-[12.5px] text-muted">{c.email || 'Geen e-mailadres'}</div>
                  </div>
                  {c.tags.map((t) => <span key={t} className="rounded-full bg-subtle px-2 py-0.5 text-[11.5px] text-muted ring-1 ring-line">{t}</span>)}
                </label>
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="space-y-4 p-5">
            <div className="text-[14px] font-semibold">Wat factureer je?</div>
            {products.length > 0 && (
              <Field label="Kies uit producten" optional>
                <Select value="" onChange={(e) => { const p = products.find((x) => x.id === e.target.value); if (p) { setDesc(p.name); setAmount(String(p.price).replace('.', ',')); setVat(p.vatRate); } }}>
                  <option value="">Product kiezen…</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name} · {formatEUR(p.price)}</option>)}
                </Select>
              </Field>
            )}
            <Field label="Omschrijving"><Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Contributie seizoen 2026/2027" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={org.vatRegistered ? 'Bedrag excl. btw' : 'Bedrag'}><Input prefix="€" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
              {org.vatRegistered && (
                <Field label="Btw"><Select value={vat} onChange={(e) => setVat(Number(e.target.value) as VatRate)}><option value={21}>21%</option><option value={9}>9%</option><option value={0}>0%</option></Select></Field>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Factuurdatum"><Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} /></Field>
              <Field label="Betaaltermijn"><Input type="number" suffix="dagen" value={term} onChange={(e) => setTerm(e.target.value)} /></Field>
            </div>
            <Field label="Kenmerk" optional><Input value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
          </Card>
          <Card className="overflow-hidden">
            <div className="p-5">
              <div className="flex items-center gap-2 text-[13px] text-muted"><Users className="size-4" /> {pluralize(count, 'relatie', 'relaties')} geselecteerd</div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-[13.5px] text-muted">{formatEUR(each)} per factuur</span>
                <span className="tabular font-display text-[24px] font-semibold">{formatEUR(each * count)}</span>
              </div>
              {count > 0 && <div className="mt-1 text-[12.5px] text-muted">Nummers {formatDocNumber(org.invoicePrefix, org.nextInvoiceNumber)} t/m {formatDocNumber(org.invoicePrefix, org.nextInvoiceNumber + count - 1)}</div>}
            </div>
            <div className="border-t border-line bg-subtle/60 p-4">
              <Button size="lg" className="w-full" disabled={!count || !desc.trim() || price <= 0} onClick={create}><Layers /> Maak {count || ''} {count === 1 ? 'factuur' : 'facturen'}</Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
