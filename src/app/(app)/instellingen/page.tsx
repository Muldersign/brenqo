'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Building, FileText, BellRing, CreditCard, Landmark, Mail, Zap, Tags, Users, RotateCcw, Upload, Check, Plus, Trash,
  CircleCheck, Repeat, Brain, Send, Globe, Copy, Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { useBankAccounts, useCategories, useMembers, useOrg, useStore } from '@/lib/store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Field, Input, Select, Textarea, TextField } from '@/components/ui/input';
import { Switch, SwitchRow } from '@/components/ui/switch';
import { Avatar, PageHeader } from '@/components/ui/misc';
import { Modal } from '@/components/ui/dialog';
import { InvoiceDocument } from '@/components/documents/invoice-document';
import { OrgMark } from '@/components/shell/org-switcher';
import { CategoryIcon } from '@/components/category-icon';
import { formatDocNumber } from '@/lib/domain/numbering';
import { todayISO, addDays } from '@/lib/domain/dates';
import type { Organization, VatRate } from '@/lib/types';
import { cn, initials } from '@/lib/utils';

const TABS = [
  { id: 'bedrijf', label: 'Bedrijf', icon: Building },
  { id: 'facturen', label: 'Facturen', icon: FileText },
  { id: 'herinneringen', label: 'Herinneringen', icon: BellRing },
  { id: 'betalingen', label: 'Betalingen', icon: CreditCard },
  { id: 'bank', label: 'Bank', icon: Landmark },
  { id: 'email', label: 'E-mail', icon: Mail },
  { id: 'automatisering', label: 'Automatisering', icon: Zap },
  { id: 'categorieen', label: 'Categorieën', icon: Tags },
  { id: 'gebruikers', label: 'Gebruikers', icon: Users },
] as const;

const ACCENTS = ['#171717', '#404040', '#737373', '#5B4BF5', '#2563EB', '#0E9F7E', '#D97706', '#E11D48'];

export default function SettingsPage() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = params.get('tab') ?? 'bedrijf';
  const org = useOrg();
  const update = useStore((s) => s.updateOrganization);

  return (
    <div className="animate-fade-in">
      <PageHeader title="Instellingen" description={<>Voor <span className="font-medium text-ink-2">{org.name}</span>. Wijzigingen worden direct opgeslagen.</>} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 scrollbar-none lg:mx-0 lg:flex-col lg:px-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => router.replace(`/instellingen?tab=${t.id}`, { scroll: false })}
              className={cn('flex h-9 shrink-0 items-center gap-2.5 rounded-[11px] px-3 text-[14px] font-medium transition', tab === t.id ? 'bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.04)]' : 'text-muted hover:bg-black/[0.035] hover:text-ink')}
            >
              <t.icon className={cn('size-4', tab === t.id && 'text-brand-600')} />{t.label}
            </button>
          ))}
        </nav>
        <div className="min-w-0 space-y-5">
          {tab === 'bedrijf' && <CompanyTab org={org} update={update} />}
          {tab === 'facturen' && <InvoiceTab org={org} update={update} />}
          {tab === 'herinneringen' && <RemindersTab org={org} update={update} />}
          {tab === 'betalingen' && <PaymentsTab org={org} update={update} />}
          {tab === 'bank' && <BankTab />}
          {tab === 'email' && <EmailTab org={org} update={update} />}
          {tab === 'automatisering' && <AutomationTab org={org} update={update} />}
          {tab === 'categorieen' && <CategoriesTab />}
          {tab === 'gebruikers' && <UsersTab />}
        </div>
      </div>
    </div>
  );
}

type TabProps = { org: Organization; update: (p: Partial<Organization>) => void };

function Section({ title, description, children, className }: { title: string; description?: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={cn('p-5 sm:p-6', className)}>
      <div className="mb-5">
        <h2 className="font-display text-[16px] font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-[13.5px] text-muted">{description}</p>}
      </div>
      {children}
    </Card>
  );
}

async function fileToLogo(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
  const size = 256;
  const scale = Math.min(1, size / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(url);
  return c.toDataURL('image/png');
}

function CompanyTab({ org, update }: TabProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const t = (k: keyof Organization, label: string, extra: Partial<React.ComponentProps<typeof TextField>> = {}) => (
    <TextField label={label} value={String(org[k] ?? '')} onChange={(e) => update({ [k]: e.target.value } as Partial<Organization>)} {...extra} />
  );
  return (
    <>
      <Section title="Logo en naam" description="Staat op je facturen, offertes en de online factuurpagina.">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <OrgMark org={org} size={72} className="rounded-[20px]" />
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { update({ logoDataUrl: await fileToLogo(f) }); toast.success('Logo bijgewerkt'); } }} />
            <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload /> Logo uploaden</Button>
            {org.logoDataUrl && <Button variant="ghost" onClick={() => update({ logoDataUrl: undefined })}>Verwijderen</Button>}
          </div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <TextField label="Bedrijfsnaam" value={org.name} onChange={(e) => update({ name: e.target.value, initials: initials(e.target.value) })} />
          {t('tradeName', 'Handelsnaam')}
        </div>
      </Section>
      <Section title="Adres en contact">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {t('address', 'Adres')}
          <div className="grid grid-cols-[120px_1fr] gap-3">{t('postalCode', 'Postcode')}{t('city', 'Plaats')}</div>
          {t('country', 'Land')}
          {t('email', 'E-mail', { type: 'email' })}
          {t('phone', 'Telefoon')}
          {t('website', 'Website')}
        </div>
      </Section>
      <Section title="Registratie en bank" description="Verplicht op een factuur. Je vult het één keer in.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {t('kvk', 'KvK-nummer')}
          {t('vatNumber', 'Btw-nummer', { placeholder: 'NL000000000B01' })}
          {t('iban', 'IBAN')}
          {t('bic', 'BIC', { optional: true })}
        </div>
        <div className="mt-4 rounded-2xl px-4 ring-1 ring-line">
          <SwitchRow title="Btw-plichtig" description={org.kind === 'association' ? 'Veel verenigingen zijn vrijgesteld. Zet dit aan als jullie wel btw rekenen.' : 'Zet dit uit als je gebruikmaakt van de kleineondernemersregeling (KOR).'} checked={org.vatRegistered} onCheckedChange={(v) => update({ vatRegistered: v, defaultVatRate: v ? 21 : 0 })} />
        </div>
      </Section>
    </>
  );
}

function InvoiceTab({ org, update }: TabProps) {
  const today = todayISO();
  return (
    <>
      <Section title="Nummering" description="Iedere administratie heeft zijn eigen, doorlopende nummering.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <TextField label="Factuurprefix" value={org.invoicePrefix} onChange={(e) => update({ invoicePrefix: e.target.value })} />
          <Field label="Volgende factuurnummer"><Input type="number" min={1} value={org.nextInvoiceNumber} onChange={(e) => update({ nextInvoiceNumber: Math.max(1, Number(e.target.value)) })} /></Field>
          <Field label="Voorbeeld"><div className="flex h-10 items-center rounded-[12px] bg-subtle px-3.5 font-medium tabular ring-1 ring-line">{formatDocNumber(org.invoicePrefix, org.nextInvoiceNumber)}</div></Field>
          <TextField label="Offerteprefix" value={org.quotePrefix} onChange={(e) => update({ quotePrefix: e.target.value })} />
          <Field label="Volgende offertenummer"><Input type="number" min={1} value={org.nextQuoteNumber} onChange={(e) => update({ nextQuoteNumber: Math.max(1, Number(e.target.value)) })} /></Field>
        </div>
      </Section>
      <Section title="Standaardwaarden">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Betaaltermijn"><Input type="number" suffix="dagen" value={org.paymentTermDays} onChange={(e) => update({ paymentTermDays: Number(e.target.value) })} /></Field>
          <Field label="Offerte geldig"><Input type="number" suffix="dagen" value={org.quoteValidDays} onChange={(e) => update({ quoteValidDays: Number(e.target.value) })} /></Field>
          <Field label="Standaard btw"><Select value={org.defaultVatRate} onChange={(e) => update({ defaultVatRate: Number(e.target.value) as VatRate })}><option value={21}>21%</option><option value={9}>9%</option><option value={0}>0%</option></Select></Field>
        </div>
        <Field label="Standaard factuurtekst" className="mt-4"><Textarea value={org.defaultInvoiceNote} onChange={(e) => update({ defaultInvoiceNote: e.target.value })} className="min-h-[70px]" /></Field>
      </Section>
      <Section title="Uitstraling" description="Kies een accentkleur. Je ziet direct hoe je factuur eruitziet.">
        <div className="flex flex-wrap items-center gap-2.5">
          {ACCENTS.map((c) => (
            <button key={c} onClick={() => update({ accentColor: c })} className={cn('grid size-9 place-items-center rounded-full ring-offset-2 transition', org.accentColor.toLowerCase() === c.toLowerCase() && 'ring-2 ring-ink')} style={{ background: c }} aria-label={`Kleur ${c}`}>
              {org.accentColor.toLowerCase() === c.toLowerCase() && <Check className="size-4 text-white" />}
            </button>
          ))}
          <label className="ml-2 flex items-center gap-2 text-[13px] text-muted">Eigen kleur <input type="color" value={org.accentColor} onChange={(e) => update({ accentColor: e.target.value })} className="size-9 cursor-pointer rounded-full border-0 bg-transparent" /></label>
        </div>
        <div className="mt-6 overflow-hidden rounded-[18px] ring-1 ring-line">
          <div className="pointer-events-none origin-top-left scale-[0.62] sm:scale-[0.7]" style={{ width: `${100 / 0.62}%`, marginBottom: '-38%' }}>
            <InvoiceDocument org={org} doc={{ kind: 'invoice', number: formatDocNumber(org.invoicePrefix, org.nextInvoiceNumber), issueDate: today, dueDate: addDays(today, org.paymentTermDays), reference: '', note: org.defaultInvoiceNote, lines: [
              { id: 'a', description: 'Website onderhoud', quantity: 2, unit: 'uur', unitPrice: 75, vatRate: org.vatRegistered ? 21 : 0, discountPct: 0 },
              { id: 'b', description: 'Hosting', quantity: 1, unit: 'jaar', unitPrice: 180, vatRate: org.vatRegistered ? 21 : 0, discountPct: 0 },
            ] }} customer={{ id: 'x', organizationId: org.id, companyName: 'De Leo Media', contactName: 'Leo de Vries', email: '', phone: '', address: 'Industrieweg 8', postalCode: '9403 AB', city: 'Assen', country: 'Nederland', kvk: '', vatNumber: '', iban: '', paymentTermDays: 14, defaultInvoiceText: '', remindersEnabled: true, tags: [], createdAt: '' }} />
          </div>
        </div>
      </Section>
    </>
  );
}

function RemindersTab({ org, update }: TabProps) {
  const setStep = (id: string, patch: Partial<Organization['reminders']['steps'][number]>) => update({ reminders: { ...org.reminders, steps: org.reminders.steps.map((s) => (s.id === id ? { ...s, ...patch } : s)) } });
  return (
    <>
      <Card className="px-5 sm:px-6">
        <SwitchRow icon={<BellRing />} title="Automatische betalingsherinneringen" description="Brenqo stuurt vriendelijke herinneringen met betaallink. Zodra er betaald is, stopt het vanzelf." checked={org.reminders.enabled} onCheckedChange={(v) => update({ reminders: { ...org.reminders, enabled: v } })} />
      </Card>
      <div className={cn('space-y-4', !org.reminders.enabled && 'pointer-events-none opacity-50')}>
        {org.reminders.steps.map((s, i) => (
          <Card key={s.id} className="p-5 sm:p-6">
            <div className="flex items-center gap-4">
              <span className="grid size-8 place-items-center rounded-full bg-brand-50 text-[13px] font-semibold text-brand-700">{i + 1}</span>
              <div className="flex-1">
                <div className="text-[15px] font-semibold">{s.label}</div>
                <div className="text-[13px] text-muted">{s.daysAfterDue} dagen na de vervaldatum</div>
              </div>
              <Switch checked={s.enabled} onCheckedChange={(v) => setStep(s.id, { enabled: v })} />
            </div>
            {s.enabled && (
              <div className="mt-5 grid gap-4 border-t border-line pt-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[180px_1fr]">
                  <Field label="Versturen na"><Input type="number" min={0} suffix="dagen" value={s.daysAfterDue} onChange={(e) => setStep(s.id, { daysAfterDue: Number(e.target.value) })} /></Field>
                  <TextField label="Onderwerp" value={s.subject} onChange={(e) => setStep(s.id, { subject: e.target.value })} />
                </div>
                <Field label="Bericht" hint="Gebruik [naam], [factuurnummer], [bedrag], [vervaldatum] en [bedrijf]. De betaalknop wordt automatisch toegevoegd."><Textarea value={s.body} onChange={(e) => setStep(s.id, { body: e.target.value })} className="min-h-[180px]" /></Field>
              </div>
            )}
          </Card>
        ))}
      </div>
      <p className="px-1 text-[13px] text-muted">Herinneringen uitzetten voor één klant of één factuur? Dat kan op de klant- of factuurpagina.</p>
    </>
  );
}

function PaymentsTab({ org, update }: TabProps) {
  const [connecting, setConnecting] = useState(false);
  const p = org.payments;
  const set = (patch: Partial<Organization['payments']>) => update({ payments: { ...p, ...patch } });
  const m = (k: keyof Organization['payments']['methods'], v: boolean) => set({ methods: { ...p.methods, [k]: v } });
  return (
    <>
      <Section title="Online betalen" description="Laat klanten direct betalen vanaf de factuur. Betaald? Dan staat de factuur vanzelf op betaald.">
        <div className="flex flex-col gap-4 rounded-2xl bg-subtle p-4 ring-1 ring-line sm:flex-row sm:items-center">
          <div className="grid size-12 place-items-center rounded-2xl bg-ink font-display text-[15px] font-semibold text-white">mollie</div>
          <div className="flex-1">
            <div className="flex items-center gap-2 text-[15px] font-semibold">Mollie {p.connected && <Badge tone="success" dot>Gekoppeld</Badge>}</div>
            <div className="text-[13px] text-muted">{p.connected ? 'Betalingen komen binnen op je eigen rekening. Webhooks zijn actief.' : 'Koppel je Mollie-account in een minuut.'}</div>
          </div>
          {p.connected
            ? <Button variant="outline" onClick={() => { set({ connected: false, provider: 'none' }); toast('Mollie ontkoppeld'); }}>Ontkoppelen</Button>
            : <Button loading={connecting} onClick={() => { setConnecting(true); setTimeout(() => { set({ connected: true, provider: 'mollie' }); setConnecting(false); toast.success('Mollie is gekoppeld'); }, 1200); }}>Koppel Mollie</Button>}
        </div>
        <div className="mt-2 divide-y divide-line">
          <SwitchRow title="Betaallink op factuur" description="Een betaalknop op de online factuur en een link in de PDF." checked={p.payLinkOnInvoice} onCheckedChange={(v) => set({ payLinkOnInvoice: v })} />
          <SwitchRow title="Betaalknop in e-mail" description="Je klant betaalt direct vanuit de mail." checked={p.payButtonInEmail} onCheckedChange={(v) => set({ payButtonInEmail: v })} />
        </div>
      </Section>
      <Section title="Betaalmethoden">
        <div className="divide-y divide-line">
          <SwitchRow title="iDEAL" description="De meest gebruikte manier van betalen in Nederland." checked={p.methods.ideal} onCheckedChange={(v) => m('ideal', v)} />
          <SwitchRow title="Bancontact" description="Voor klanten in België." checked={p.methods.bancontact} onCheckedChange={(v) => m('bancontact', v)} />
          <SwitchRow title="Creditcard" checked={p.methods.creditcard} onCheckedChange={(v) => m('creditcard', v)} />
          <SwitchRow title="Bankoverschrijving" description="Je IBAN en het factuurnummer staan altijd op de factuur." checked={p.methods.banktransfer} onCheckedChange={(v) => m('banktransfer', v)} />
        </div>
      </Section>
    </>
  );
}

function BankTab() {
  const accounts = useBankAccounts();
  return (
    <Section title="Bankkoppeling" description="Transacties worden automatisch opgehaald via PSD2 (alleen lezen).">
      <ul className="space-y-2">
        {accounts.map((a) => (
          <li key={a.id} className="flex items-center gap-3 rounded-2xl p-3 ring-1 ring-line">
            <span className="grid size-10 place-items-center rounded-xl text-[12px] font-semibold text-white" style={{ background: a.color }}>{a.bankName.slice(0, 2)}</span>
            <div className="min-w-0 flex-1"><div className="text-[14px] font-medium">{a.name}</div><div className="font-mono text-[12px] text-muted">{a.iban}</div></div>
            <Badge tone="success" dot>Actief</Badge>
          </li>
        ))}
      </ul>
      <Button variant="outline" className="mt-4" asChild><Link href="/bank/rekeningen"><Plus /> Rekening koppelen</Link></Button>
    </Section>
  );
}

function EmailTab({ org, update }: TabProps) {
  return (
    <>
      <Section title="Factuur e-mail" description="Gebruik [naam], [factuurnummer], [bedrag], [vervaldatum] en [bedrijf].">
        <div className="space-y-4">
          <TextField label="Onderwerp" value={org.invoiceEmailSubject} onChange={(e) => update({ invoiceEmailSubject: e.target.value })} />
          <Field label="Bericht"><Textarea value={org.invoiceEmailBody} onChange={(e) => update({ invoiceEmailBody: e.target.value })} className="min-h-[200px]" /></Field>
        </div>
      </Section>
      <Section title="Offerte e-mail">
        <div className="space-y-4">
          <TextField label="Onderwerp" value={org.quoteEmailSubject} onChange={(e) => update({ quoteEmailSubject: e.target.value })} />
          <Field label="Bericht"><Textarea value={org.quoteEmailBody} onChange={(e) => update({ quoteEmailBody: e.target.value })} className="min-h-[160px]" /></Field>
        </div>
      </Section>
      <Section title="Inbox voor inkoopfacturen" description="Facturen die naar dit adres worden gestuurd, worden automatisch uitgelezen.">
        <div className="flex items-center gap-2 rounded-xl bg-subtle p-1.5 pl-3 ring-1 ring-line">
          <Mail className="size-4 text-muted" /><span className="flex-1 truncate text-[14px] font-medium">{org.inboxAddress}</span>
          <Button size="sm" variant="outline" onClick={() => { navigator.clipboard?.writeText(org.inboxAddress); toast.success('Gekopieerd'); }}><Copy /> Kopieer</Button>
        </div>
      </Section>
      <Section title="Verzending">
        <div className="text-[13.5px] text-muted">Mails gaan uit namens <span className="font-medium text-ink">{org.name}</span> via een beveiligde verzendserver. Antwoorden van klanten komen binnen op <span className="font-medium text-ink">{org.email || 'je e-mailadres'}</span>.</div>
      </Section>
    </>
  );
}

function AutomationTab({ org, update }: TabProps) {
  const a = org.automations;
  const set = (k: keyof Organization['automations'], v: boolean) => update({ automations: { ...a, [k]: v } });
  const rows: [keyof Organization['automations'], string, string, React.ReactNode][] = [
    ['autoMarkPaidOnBankMatch', 'Markeer facturen automatisch als betaald bij bankmatch', 'Alleen als we heel zeker zijn (bedrag, naam én kenmerk kloppen). Anders vragen we het je eerst.', <CircleCheck key="1" />],
    ['recognizeSuppliers', 'Herken terugkerende leveranciers automatisch', 'Adobe was vorige keer Software? Dan vullen we dat voortaan alvast in.', <Brain key="2" />],
    ['sendReminders', 'Stuur betalingsherinneringen automatisch', 'Volgens het schema bij Herinneringen.', <BellRing key="3" />],
    ['createRecurring', 'Maak periodieke facturen automatisch', 'Op de geplande datum staat de factuur klaar.', <Repeat key="4" />],
    ['sendRecurring', 'Verstuur periodieke facturen automatisch', 'Direct per e-mail naar je klant, met betaallink.', <Send key="5" />],
    ['processOnlinePayments', 'Verwerk betaalde online facturen automatisch', 'Betaling via iDEAL ontvangen? Factuur op betaald, betaaldatum opgeslagen.', <Globe key="6" />],
  ];
  return (
    <Section title="Automatiseringen" description="Laat Brenqo het werk op de achtergrond doen. Je kunt alles op ieder moment aan of uit zetten.">
      <div className="divide-y divide-line">
        {rows.map(([k, title, desc, icon]) => <SwitchRow key={k} icon={icon} title={title} description={desc} checked={a[k]} onCheckedChange={(v) => set(k, v)} />)}
      </div>
    </Section>
  );
}

function CategoriesTab() {
  const categories = useCategories();
  const add = useStore((s) => s.addCategory);
  const del = useStore((s) => s.deleteCategory);
  const [name, setName] = useState('');
  return (
    <Section title="Kostencategorieën" description="Houd het simpel. Voeg alleen iets toe als je het echt apart wilt zien.">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {categories.map((c) => (
          <div key={c.id} className="group flex items-center gap-3 rounded-xl p-2.5 ring-1 ring-line">
            <span className="grid size-8 place-items-center rounded-lg bg-subtle text-muted"><CategoryIcon name={c.name} /></span>
            <span className="flex-1 text-[14px] font-medium">{c.name}</span>
            {c.custom && <button onClick={() => { del(c.id); toast.success('Categorie verwijderd'); }} className="grid size-7 place-items-center rounded-lg text-faint opacity-0 transition hover:bg-danger-50 hover:text-danger-600 group-hover:opacity-100" aria-label="Verwijderen"><Trash className="size-3.5" /></button>}
          </div>
        ))}
      </div>
      <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) { add(name.trim()); setName(''); toast.success('Categorie toegevoegd'); } }}>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nieuwe categorie, bijv. Opleiding" />
        <Button type="submit" variant="outline"><Plus /> Toevoegen</Button>
      </form>
    </Section>
  );
}

function UsersTab() {
  const members = useMembers();
  const invite = useStore((s) => s.inviteMember);
  const resetDemo = useStore((s) => s.resetDemo);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', role: 'admin' as 'admin' | 'viewer' });
  const roleLabel = { owner: 'Eigenaar', admin: 'Beheerder', viewer: 'Alleen lezen' };
  return (
    <>
      <Section title="Gebruikers" description="Wie heeft toegang tot deze administratie? Bijvoorbeeld je boekhouder (alleen lezen).">
        <ul className="space-y-2">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 rounded-xl p-2.5 ring-1 ring-line">
              <Avatar name={m.name} size={36} />
              <div className="min-w-0 flex-1"><div className="truncate text-[14px] font-medium">{m.name}</div><div className="truncate text-[12.5px] text-muted">{m.email}</div></div>
              <Badge tone={m.role === 'owner' ? 'brand' : 'neutral'}>{roleLabel[m.role]}</Badge>
            </li>
          ))}
        </ul>
        <Button variant="outline" className="mt-4" onClick={() => setOpen(true)}><Plus /> Iemand uitnodigen</Button>
      </Section>
      <Section title="Demo-gegevens" description="Begin opnieuw met de voorbeeldadministraties Muldersign en V&Z Veendam.">
        <Button variant="outline" onClick={() => { resetDemo(); toast.success('Demo-gegevens hersteld'); }}><RotateCcw /> Demo herstellen</Button>
      </Section>
      <div className="flex items-center gap-2 px-1 text-[12.5px] text-muted"><Sparkles className="size-3.5" /> Iedere administratie is volledig gescheiden: gebruikers zien alleen de administraties waar ze lid van zijn.</div>
      <Modal open={open} onOpenChange={setOpen} title="Iemand uitnodigen" size="sm" footer={<><Button variant="outline" onClick={() => setOpen(false)}>Annuleren</Button><Button disabled={!form.email} onClick={() => { invite(form); setOpen(false); toast.success(`Uitnodiging verstuurd naar ${form.email}`); setForm({ name: '', email: '', role: 'admin' }); }}>Uitnodigen</Button></>}>
        <div className="space-y-4">
          <TextField label="Naam" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <TextField label="E-mail" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Field label="Rol"><Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as 'admin' | 'viewer' })}><option value="admin">Beheerder: mag alles</option><option value="viewer">Alleen lezen: bijvoorbeeld je boekhouder</option></Select></Field>
        </div>
      </Modal>
    </>
  );
}
