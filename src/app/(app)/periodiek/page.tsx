'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Repeat, Plus, Pause, Play, Pencil, Trash, Send, CalendarClock, FilePlus } from 'lucide-react';
import { toast } from 'sonner';
import { useCustomerMap, useOrg, useRecurring, useStore } from '@/lib/store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, EmptyState, PageHeader } from '@/components/ui/misc';
import { Drawer } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/input';
import { SwitchRow } from '@/components/ui/switch';
import { CustomerPicker } from '@/components/documents/customer-picker';
import { LinesEditor, newLine } from '@/components/documents/lines-editor';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu';
import { documentTotals } from '@/lib/domain/calc';
import { formatEUR } from '@/lib/domain/money';
import { formatDate, relativeDay, todayISO } from '@/lib/domain/dates';
import { frequencyLabel, frequencyShort, yearlyValue } from '@/lib/domain/recurring';
import type { DocumentLine, Frequency, RecurringInvoice } from '@/lib/types';
import { cn } from '@/lib/utils';

type Form = { id?: string; name: string; customerId: string; lines: DocumentLine[]; frequency: Frequency; startDate: string; autoCreate: boolean; autoSend: boolean };

export default function RecurringPage() {
  const items = useRecurring();
  const customers = useCustomerMap();
  const org = useOrg();
  const save = useStore((s) => s.saveRecurring);
  const remove = useStore((s) => s.deleteRecurring);
  const runAutomations = useStore((s) => s.runAutomations);
  const [form, setForm] = useState<Form | null>(null);
  const today = todayISO();

  const active = items.filter((r) => r.active);
  const yearly = active.reduce((s, r) => s + yearlyValue(documentTotals(r.lines).subtotal, r.frequency), 0);

  const open = (r?: RecurringInvoice) => setForm(r
    ? { id: r.id, name: r.name, customerId: r.customerId, lines: r.lines, frequency: r.frequency, startDate: r.nextDate, autoCreate: r.autoCreate, autoSend: r.autoSend }
    : { name: '', customerId: '', lines: [newLine(org.defaultVatRate)], frequency: 'monthly', startDate: today, autoCreate: true, autoSend: false });

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Periodieke facturen"
        description="Voor hosting, onderhoud en andere terugkerende diensten. Brenqo maakt (en verstuurt) ze automatisch."
        actions={<Button onClick={() => open()}><Plus strokeWidth={2.5} /> Nieuwe periodieke factuur</Button>}
      />
      {items.length > 0 && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Card className="p-4"><div className="text-[13px] text-muted">Actief</div><div className="mt-1 font-display text-[22px] font-bold">{active.length}</div></Card>
          <Card className="p-4"><div className="text-[13px] text-muted">Terugkerende omzet per jaar</div><div className="tabular mt-1 font-display text-[22px] font-bold">{formatEUR(yearly, { round: true })}</div></Card>
          <Card className="col-span-2 p-4 sm:col-span-1"><div className="text-[13px] text-muted">Per maand gemiddeld</div><div className="tabular mt-1 font-display text-[22px] font-bold">{formatEUR(yearly / 12, { round: true })}</div></Card>
        </div>
      )}
      {items.length === 0 ? (
        <Card><EmptyState icon={<Repeat />} title="Nog geen periodieke facturen" description="Stel het één keer in, en Brenqo maakt iedere maand, ieder kwartaal of ieder jaar de factuur voor je." action={<Button onClick={() => open()} size="lg"><Plus /> Eerste instellen</Button>} /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((r) => {
            const c = customers.get(r.customerId);
            const t = documentTotals(r.lines);
            return (
              <Card key={r.id} className={cn('flex flex-col p-5 transition hover:shadow-raised', !r.active && 'opacity-70')}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={c?.companyName ?? '?'} size={40} />
                    <div className="min-w-0">
                      <div className="truncate text-[15px] font-semibold">{r.name}</div>
                      <div className="truncate text-[13px] text-muted">{c?.companyName}</div>
                    </div>
                  </div>
                  <Menu>
                    <MenuTrigger asChild><button className="grid size-8 place-items-center rounded-lg text-muted hover:bg-black/5" aria-label="Acties">⋯</button></MenuTrigger>
                    <MenuContent>
                      <MenuItem icon={<Pencil />} onSelect={() => open(r)}>Bewerken</MenuItem>
                      <MenuItem icon={r.active ? <Pause /> : <Play />} onSelect={() => { save({ ...r, active: !r.active }); toast.success(r.active ? 'Gepauzeerd' : 'Weer actief'); }}>{r.active ? 'Pauzeren' : 'Hervatten'}</MenuItem>
                      <MenuItem icon={<FilePlus />} onSelect={() => { save({ ...r, nextDate: today }); const res = runAutomations(); toast.success(res.recurring ? 'Factuur aangemaakt' : 'Automatisch aanmaken staat uit'); }}>Nu factureren</MenuItem>
                      <MenuItem icon={<Trash />} danger onSelect={() => { remove(r.id); toast.success('Verwijderd'); }}>Verwijderen</MenuItem>
                    </MenuContent>
                  </Menu>
                </div>
                <div className="mt-5 flex items-baseline gap-1.5">
                  <span className="tabular font-display text-[28px] font-bold tracking-[-0.02em]">{formatEUR(t.total)}</span>
                  <span className="text-[13.5px] text-muted">{frequencyShort[r.frequency]}</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {r.active ? <Badge tone="success" dot>Actief</Badge> : <Badge tone="muted" dot>Gepauzeerd</Badge>}
                  <Badge tone="neutral">{frequencyLabel[r.frequency]}</Badge>
                  {r.autoSend && <Badge tone="brand"><Send className="size-3" /> Automatisch versturen</Badge>}
                </div>
                <div className="mt-auto flex items-center gap-2 border-t border-line pt-4 text-[13px] text-muted" style={{ marginTop: 20 }}>
                  <CalendarClock className="size-4" />
                  {r.active ? <>Volgende factuur {formatDate(r.nextDate)} <span className="text-faint">({relativeDay(r.nextDate, today)})</span></> : 'Er worden geen facturen gemaakt'}
                </div>
                {r.invoiceIds.length > 0 && <Link href={`/facturen/${r.invoiceIds[r.invoiceIds.length - 1]}`} className="mt-2 text-[12.5px] font-medium text-brand-600">Laatste factuur bekijken →</Link>}
              </Card>
            );
          })}
        </div>
      )}

      <Drawer
        open={!!form}
        onOpenChange={(o) => !o && setForm(null)}
        title={form?.id ? 'Periodieke factuur bewerken' : 'Nieuwe periodieke factuur'}
        width={640}
        footer={
          <>
            <Button variant="outline" className="flex-1" onClick={() => setForm(null)}>Annuleren</Button>
            <Button className="flex-1" disabled={!form?.customerId || !form?.name.trim()} onClick={() => {
              if (!form) return;
              save({ id: form.id, name: form.name, customerId: form.customerId, lines: form.lines, frequency: form.frequency, startDate: form.startDate, nextDate: form.startDate, autoCreate: form.autoCreate, autoSend: form.autoSend });
              setForm(null);
              toast.success('Periodieke factuur opgeslagen', { description: `De eerste factuur komt op ${formatDate(form.startDate)}.` });
            }}>Opslaan</Button>
          </>
        }
      >
        {form && (
          <div className="space-y-5">
            <Field label="Naam"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Bijvoorbeeld: Hosting" /></Field>
            <Field label="Klant"><CustomerPicker value={form.customerId} onChange={(id) => setForm({ ...form, customerId: id })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Frequentie">
                <Select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value as Frequency })}>
                  {Object.entries(frequencyLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </Select>
              </Field>
              <Field label={form.id ? 'Volgende factuur' : 'Startdatum'}><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></Field>
            </div>
            <div>
              <div className="mb-2 text-[13px] font-medium text-ink-2">Factuurregels</div>
              <LinesEditor lines={form.lines} onChange={(lines) => setForm({ ...form, lines })} showVat={org.vatRegistered} />
            </div>
            <div className="divide-y divide-line rounded-2xl px-4 ring-1 ring-line">
              <SwitchRow title="Factuur automatisch aanmaken" description="Op de geplande datum staat de factuur klaar." checked={form.autoCreate} onCheckedChange={(v) => setForm({ ...form, autoCreate: v, autoSend: v && form.autoSend })} />
              <SwitchRow title="Factuur automatisch versturen" description="Direct per e-mail naar de klant, met betaallink." checked={form.autoSend} disabled={!form.autoCreate} onCheckedChange={(v) => setForm({ ...form, autoSend: v })} />
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
