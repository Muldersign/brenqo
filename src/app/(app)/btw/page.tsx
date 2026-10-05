'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CalendarClock, Info, ArrowDownLeft, ArrowUpRight, Scale, Download, CircleCheck, FileText, Receipt } from 'lucide-react';
import { useExpenses, useInvoices, useOrg } from '@/lib/store';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AnimatedNumber, EmptyState, IconTile, PageHeader, Segmented } from '@/components/ui/misc';
import { quarterRange, relevantVatQuarter, vatDeadline, vatSummary } from '@/lib/domain/vat';
import { documentTotals } from '@/lib/domain/calc';
import { formatEUR } from '@/lib/domain/money';
import { daysBetween, formatDateLong, todayISO } from '@/lib/domain/dates';
import { cn } from '@/lib/utils';

export default function VatPage() {
  const org = useOrg();
  const invoices = useInvoices();
  const expenses = useExpenses();
  const today = todayISO();
  const rel = relevantVatQuarter(today);
  const [year, setYear] = useState(rel.year);
  const [q, setQ] = useState(rel.q);
  const quarters = [1, 2, 3, 4].map((n) => {
    const r = quarterRange(year, n);
    return { n, ...r, summary: vatSummary(invoices, expenses, r.from, r.to), deadline: vatDeadline(year, n) };
  });
  const cur = quarters[q - 1];
  const s = cur.summary;
  const daysLeft = daysBetween(today, cur.deadline);
  const future = cur.from > today;
  const running = today >= cur.from && today <= cur.to;

  // Rubrieken as on the Dutch return (1a/1b/5b) — so the numbers can be copied 1:1.
  const rubrieken = useMemo(() => {
    let base21 = 0, vat21 = 0, base9 = 0, vat9 = 0, base0 = 0;
    for (const inv of invoices) {
      if (inv.state === 'draft' || inv.issueDate < cur.from || inv.issueDate > cur.to) continue;
      for (const r of documentTotals(inv.lines).vatByRate) {
        if (r.rate === 21) { base21 += r.base; vat21 += r.vat; } else if (r.rate === 9) { base9 += r.base; vat9 += r.vat; } else base0 += r.base;
      }
    }
    return { base21, vat21, base9, vat9, base0 };
  }, [invoices, cur.from, cur.to]);

  if (!org.vatRegistered) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Btw" />
        <Card><EmptyState icon={<Scale />} title={`${org.name} is niet btw-plichtig`} description="Er wordt geen btw berekend op facturen en je hoeft geen aangifte te doen. Klopt dat niet? Zet btw aan in de instellingen." action={<Button variant="outline" asChild><Link href="/instellingen">Naar instellingen</Link></Button>} /></Card>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="Btw" description="Alles voor je btw-aangifte staat hier klaar. Wij rekenen, jij neemt het over." actions={<Segmented value={String(year)} onChange={(v) => setYear(Number(v))} options={[{ value: String(rel.year - 1), label: String(rel.year - 1) }, { value: String(rel.year), label: String(rel.year) }]} />} />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {quarters.map((x) => {
          const isFuture = x.from > today;
          const filed = !isFuture && x.deadline < today;
          return (
            <button key={x.n} onClick={() => setQ(x.n)} className={cn('rounded-[18px] border bg-surface p-4 text-left shadow-card transition', q === x.n ? 'border-brand-300 ring-4 ring-brand-100' : 'border-line hover:border-line-strong', isFuture && 'opacity-60')}>
              <div className="flex items-center justify-between">
                <span className="font-display text-[15px] font-bold">Q{x.n}</span>
                {isFuture ? <Badge tone="muted">Nog niet</Badge> : filed ? <Badge tone="success"><CircleCheck className="size-3" /> Voorbij</Badge> : today <= x.to ? <Badge tone="info" dot>Loopt</Badge> : <Badge tone="warning" dot>Aangeven</Badge>}
              </div>
              <div className="tabular mt-3 font-display text-[20px] font-bold tracking-[-0.02em]">{isFuture ? '—' : formatEUR(x.summary.balance)}</div>
              <div className="text-[12px] text-muted">{x.summary.balance >= 0 ? 'te betalen' : 'terug te krijgen'}</div>
            </button>
          );
        })}
      </div>

      {future ? (
        <Card><EmptyState compact icon={<CalendarClock />} title={`Q${q} is nog niet begonnen`} description="Zodra er facturen en kosten zijn, zie je hier wat je ongeveer moet betalen." /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-4">
            <Card className="relative overflow-hidden p-6 sm:p-8">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_200px_at_0%_0%,rgba(108,92,244,0.10),transparent)]" />
              <div className="relative">
                <div className="text-[13.5px] font-medium text-muted">Geschatte {s.balance >= 0 ? 'te betalen' : 'terug te vragen'} btw · Q{q} {year}</div>
                <div className="mt-2 font-display text-[44px] font-bold leading-none tracking-[-0.04em] sm:text-[56px]"><AnimatedNumber value={Math.abs(s.balance)} format={(n) => formatEUR(n)} /></div>
                <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-2">
                  {s.balance >= 0
                    ? <>Op basis van je administratie zou je ongeveer <span className="font-semibold text-ink">{formatEUR(s.balance)}</span> btw moeten betalen{running ? ' (het kwartaal loopt nog, dus dit kan nog veranderen)' : ''}.</>
                    : <>Je hebt meer btw betaald dan ontvangen. Je krijgt ongeveer <span className="font-semibold text-ink">{formatEUR(-s.balance)}</span> terug van de Belastingdienst.</>}
                </p>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <Mini icon={<ArrowDownLeft />} tone="brand" label="Ontvangen btw" value={s.vatReceived} sub={`over ${formatEUR(s.revenueExVat)} omzet`} />
                  <Mini icon={<ArrowUpRight />} tone="warning" label="Betaalde btw" value={s.vatPaid} sub={`over ${formatEUR(s.costsExVat)} kosten`} />
                  <Mini icon={<Scale />} tone="neutral" label="Saldo" value={s.balance} sub={s.balance >= 0 ? 'te betalen' : 'terug'} />
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader title="Btw-overzicht" description="In gewone taal, met de vakjes van de aangifte erbij" />
              <dl className="divide-y divide-line px-5 py-2 sm:px-6">
                {[
                  ['Omzet exclusief btw', s.revenueExVat, `${s.invoiceCount} facturen`, ''],
                  ['  waarvan 21% btw', rubrieken.base21, `btw ${formatEUR(rubrieken.vat21)}`, '1a'],
                  ['  waarvan 9% btw', rubrieken.base9, `btw ${formatEUR(rubrieken.vat9)}`, '1b'],
                  ['  waarvan 0% / vrijgesteld', rubrieken.base0, '', '1e'],
                  ['Ontvangen btw', s.vatReceived, 'Wat je klanten aan btw betaalden', ''],
                  ['Zakelijke kosten', s.costsExVat, `${s.expenseCount} bonnetjes en facturen`, ''],
                  ['Terug te vragen btw', s.vatPaid, 'Voorbelasting', '5b'],
                ].map(([label, v, sub, rub]) => (
                  <div key={label as string} className="flex items-center justify-between gap-4 py-3.5">
                    <div className={cn('min-w-0', (label as string).startsWith('  ') && 'pl-4')}>
                      <dt className={cn('text-[14px]', (label as string).startsWith('  ') ? 'text-muted' : 'font-medium text-ink')}>{(label as string).trim()}</dt>
                      {sub && <dd className="text-[12px] text-faint">{sub as string}</dd>}
                    </div>
                    <div className="flex items-center gap-3">
                      {rub && <span className="rounded-md bg-subtle px-1.5 py-0.5 text-[11px] font-semibold text-muted ring-1 ring-line">{rub as string}</span>}
                      <span className="tabular text-[14.5px] font-semibold">{formatEUR(v as number)}</span>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between py-4">
                  <dt className="font-display text-[16px] font-bold">Saldo {s.balance >= 0 ? 'te betalen' : 'terug te krijgen'}</dt>
                  <dd className="tabular font-display text-[20px] font-bold">{formatEUR(Math.abs(s.balance))}</dd>
                </div>
              </dl>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="p-5">
              <div className="flex items-center gap-3">
                <IconTile tone={daysLeft < 0 ? 'neutral' : daysLeft < 14 ? 'warning' : 'brand'}><CalendarClock /></IconTile>
                <div>
                  <div className="text-[14px] font-semibold">{daysLeft < 0 ? 'Aangifte was uiterlijk' : `Aangifte over ${daysLeft} dagen`}</div>
                  <div className="text-[13px] text-muted">{formatDateLong(cur.deadline)}</div>
                </div>
              </div>
              <ol className="mt-5 space-y-3 text-[13.5px] text-ink-2">
                {['Controleer of alle bonnetjes en facturen van dit kwartaal erin staan.', 'Log in bij Mijn Belastingdienst Zakelijk.', 'Neem de bedragen bij 1a, 1b, 1e en 5b over.', `Betaal ${formatEUR(Math.max(0, s.balance))} vóór ${formatDateLong(cur.deadline)}.`].map((t, i) => (
                  <li key={i} className="flex gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-50 text-[12px] font-semibold text-brand-700">{i + 1}</span>{t}</li>
                ))}
              </ol>
              <Button variant="outline" className="mt-5 w-full" onClick={() => window.print()}><Download /> Overzicht printen / PDF</Button>
            </Card>
            <Card className="p-5">
              <div className="flex items-start gap-3 text-[13px] leading-relaxed text-muted">
                <Info className="mt-0.5 size-4 shrink-0" />
                <p>Brenqo rekent volgens het factuurstelsel: btw telt mee op de factuurdatum, ook als de klant nog niet betaald heeft. Dit is een hulpmiddel; de aangifte zelf doe je bij de Belastingdienst.</p>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button size="sm" variant="ghost" asChild><Link href="/facturen"><FileText /> Facturen</Link></Button>
                <Button size="sm" variant="ghost" asChild><Link href="/bonnetjes"><Receipt /> Bonnetjes</Link></Button>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function Mini({ icon, tone, label, value, sub }: { icon: React.ReactNode; tone: 'brand' | 'warning' | 'neutral'; label: string; value: number; sub: string }) {
  return (
    <div className="rounded-[16px] bg-surface/80 p-4 ring-1 ring-line">
      <div className="flex items-center gap-2 text-[12.5px] text-muted"><IconTile tone={tone} className="size-7 rounded-[9px] [&_svg]:size-3.5">{icon}</IconTile>{label}</div>
      <div className="tabular mt-2 font-display text-[19px] font-bold">{formatEUR(value)}</div>
      <div className="text-[11.5px] text-faint">{sub}</div>
    </div>
  );
}
