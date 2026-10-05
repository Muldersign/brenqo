'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ArrowUpRight, ArrowDownRight, Camera, FileText, CircleAlert, Receipt, ArrowLeftRight, CalendarClock, ChevronRight,
  Sparkles, PartyPopper, Plus, Wallet, TrendingUp, Percent, Clock, FileInput,
} from 'lucide-react';
import { useBankAccounts, useExpenses, useInvoiceRows, useInvoices, useOrg, useStore, useTransactions } from '@/lib/store';
import { useUI } from '@/lib/store/ui';
import { useAttention } from '@/components/shell/use-attention';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AnimatedNumber, Avatar, IconTile, Segmented, Amount } from '@/components/ui/misc';
import { InvoiceStatusBadge } from '@/components/ui/badge';
import { IncomeCostsChart, Legend, SERIES, Sparkline } from '@/components/charts';
import { monthlySeries, delta } from '@/lib/domain/reports';
import { vatDeadline, vatSummary, quarterRange, relevantVatQuarter } from '@/lib/domain/vat';
import { daysBetween, formatDateLong, formatDateShort, parseISODate, toISODate, todayISO } from '@/lib/domain/dates';
import { formatEUR } from '@/lib/domain/money';
import { CategoryIcon } from '@/components/category-icon';
import { DocThumb } from '@/components/flows/scan-flow';
import { cn, pluralize } from '@/lib/utils';

function greeting() {
  const h = new Date().getHours();
  if (h < 6) return 'Goedenacht';
  if (h < 12) return 'Goedemorgen';
  if (h < 18) return 'Goedemiddag';
  return 'Goedenavond';
}

export default function DashboardPage() {
  const org = useOrg();
  const user = useStore((s) => s.user);
  const rows = useInvoiceRows();
  const invoices = useInvoices();
  const expenses = useExpenses();
  const transactions = useTransactions();
  const accounts = useBankAccounts();
  const attention = useAttention();
  const openScan = useUI((s) => s.openScan);
  const setUI = useUI((s) => s.set);
  const params = useSearchParams();
  const [range, setRange] = useState<'6' | '12'>('6');
  const today = todayISO();

  // PWA shortcut "Bon scannen" opens straight into the scanner.
  useEffect(() => {
    if (params.get('scan') === '1') openScan('receipt', true);
  }, [params, openScan]);

  const stats = useMemo(() => {
    const d = parseISODate(today);
    const monthFrom = toISODate(new Date(d.getFullYear(), d.getMonth(), 1));
    // Compare month-to-date with the same days of last month, so the 5th isn't "down 90%".
    const prevFrom = toISODate(new Date(d.getFullYear(), d.getMonth() - 1, 1));
    const prevTo = toISODate(new Date(d.getFullYear(), d.getMonth() - 1, Math.min(d.getDate(), new Date(d.getFullYear(), d.getMonth(), 0).getDate())));
    const seriesFrom = toISODate(new Date(d.getFullYear(), d.getMonth() - 11, 1));
    const series = monthlySeries(invoices, expenses, seriesFrom, today);
    const cur = series[series.length - 1];
    const prev = monthlySeries(invoices, expenses, prevFrom, prevTo)[0];
    const outstanding = rows.filter((r) => ['sent', 'viewed', 'open', 'partial', 'overdue'].includes(r.status));
    const { year: vatYear, q } = relevantVatQuarter(today);
    const qr = quarterRange(vatYear, q);
    const vat = vatSummary(invoices, expenses, qr.from, qr.to);
    return {
      monthFrom, series, cur, prev, q, vat,
      deadline: vatDeadline(vatYear, q),
      outstanding,
      outstandingTotal: outstanding.reduce((s, r) => s + r.due, 0),
      overdueTotal: attention.overdue.reduce((s, r) => s + r.due, 0),
    };
  }, [invoices, expenses, rows, today, attention.overdue]);

  const chartData = range === '6' ? stats.series.slice(-6) : stats.series;
  const revDelta = delta(stats.cur.revenue, stats.prev.revenue);
  const costDelta = delta(stats.cur.costs, stats.prev.costs);
  const balance = accounts.reduce((s, a) => s + a.balance, 0);
  const daysToVat = daysBetween(today, stats.deadline);

  const attentionItems = [
    attention.overdue.length > 0 && {
      icon: <CircleAlert />, tone: 'danger' as const, href: '/facturen?filter=overdue',
      title: `${pluralize(attention.overdue.length, 'factuur is', 'facturen zijn')} verlopen`,
      sub: `${formatEUR(stats.overdueTotal)} had al binnen moeten zijn`,
    },
    attention.unpaid.length > 0 && {
      icon: <FileText />, tone: 'info' as const, href: '/facturen?filter=open',
      title: `${pluralize(attention.unpaid.length, 'factuur is', 'facturen zijn')} nog niet betaald`,
      sub: 'Nog binnen de betaaltermijn',
    },
    attention.receipts.length + attention.purchase.length > 0 && {
      icon: <Receipt />, tone: 'warning' as const, href: attention.receipts.length ? '/bonnetjes?filter=review' : '/inkoopfacturen?filter=review',
      title: `${pluralize(attention.receipts.length + attention.purchase.length, 'bonnetje moet', 'bonnetjes moeten')} nog worden gecontroleerd`,
      sub: 'Al uitgelezen, alleen even nakijken',
    },
    attention.bank.length > 0 && {
      icon: <ArrowLeftRight />, tone: 'brand' as const, href: '/bank',
      title: `${pluralize(attention.bank.length, 'banktransactie moet', 'banktransacties moeten')} nog worden gekoppeld`,
      sub: attention.suggestions.length ? `${attention.suggestions.length} met een voorstel klaar` : 'Koppel aan een factuur of categorie',
    },
    attention.drafts.length > 0 && {
      icon: <FileText />, tone: 'neutral' as const, href: '/facturen?filter=draft',
      title: `${pluralize(attention.drafts.length, 'conceptfactuur staat', 'conceptfacturen staan')} klaar`,
      sub: 'Nog niet verstuurd',
    },
    org.vatRegistered && {
      icon: <CalendarClock />, tone: daysToVat < 14 ? ('warning' as const) : ('neutral' as const), href: '/btw',
      title: `Btw-aangifte over ${daysToVat} dagen`,
      sub: `Q${stats.q} · uiterlijk ${formatDateLong(stats.deadline)}`,
    },
  ].filter(Boolean) as { icon: React.ReactNode; tone: 'danger' | 'info' | 'warning' | 'brand' | 'neutral'; href: string; title: string; sub: string }[];

  const openList = [...stats.outstanding].sort((a, b) => a.inv.dueDate.localeCompare(b.inv.dueDate)).slice(0, 5);
  const recentTx = [...transactions].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).slice(0, 6);
  const toReview = expenses.filter((e) => e.status === 'review').slice(0, 3);
  const monthName = new Intl.DateTimeFormat('nl-NL', { month: 'long' }).format(parseISODate(today));

  return (
    <div className="animate-fade-in">
      {/* Hero */}
      <section className="relative -mx-4 mb-6 overflow-hidden px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        <div className="pointer-events-none absolute inset-0 hero-gradient" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[13.5px] font-medium text-muted first-letter:uppercase">{new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}</div>
            <h1 className="mt-1 font-display text-[28px] font-bold leading-tight sm:text-[34px]">{greeting()}, {user.name.split(' ')[0]}</h1>
            <p className="mt-1.5 text-[15px] text-muted">
              {attentionItems.filter((i) => i.tone !== 'neutral').length === 0 ? 'Alles staat goed. Er is niets dat je aandacht nodig heeft.' : `Zo staat ${org.name} ervoor. Een paar dingen vragen even je aandacht.`}
            </p>
          </div>
          <div className="hidden gap-2 sm:flex">
            <Button variant="outline" onClick={() => openScan('receipt', true)}><Camera /> Bon toevoegen</Button>
            <Button asChild><Link href="/facturen/nieuw"><Plus strokeWidth={2.5} /> Nieuwe factuur</Link></Button>
          </div>
        </div>
        {/* Mobile: the most-used action, big */}
        <button
          onClick={() => openScan('receipt', true)}
          className="relative mt-5 flex w-full items-center gap-4 rounded-[22px] bg-gradient-to-br from-brand-500 to-brand-700 p-4 text-left text-white shadow-brand active:scale-[0.99] sm:hidden"
        >
          <div className="grid size-12 place-items-center rounded-2xl bg-white/15"><Camera className="size-6" /></div>
          <div className="flex-1">
            <div className="text-[16px] font-semibold">Bon scannen</div>
            <div className="text-[13px] text-white/75">Foto maken, wij lezen hem uit</div>
          </div>
          <ChevronRight className="size-5 text-white/70" />
        </button>
      </section>

      {/* KPI cards */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard
          label={`Omzet ${monthName}`}
          icon={<TrendingUp />}
          value={stats.cur.revenue}
          foot={revDelta === null ? 'excl. btw' : <DeltaPill value={revDelta} suffix="vs zelfde periode vorige maand" />}
          spark={stats.series.slice(-7).map((p) => p.revenue)}
          sparkColor={SERIES.income}
          href="/rapporten"
          highlight
        />
        <KpiCard
          label="Openstaand"
          icon={<Wallet />}
          value={stats.outstandingTotal}
          foot={
            <span className="text-[12.5px] text-muted">
              {pluralize(stats.outstanding.length, 'factuur', 'facturen')}
              {attention.overdue.length > 0 && <> · <span className="font-medium text-danger-600">{attention.overdue.length} verlopen</span></>}
            </span>
          }
          bar={stats.outstandingTotal ? { value: ((stats.outstandingTotal - stats.overdueTotal) / stats.outstandingTotal) * 100 } : undefined}
          href="/facturen?filter=open"
        />
        <KpiCard
          label={`Kosten ${monthName}`}
          icon={<Receipt />}
          value={stats.cur.costs}
          foot={costDelta === null ? 'excl. btw' : <DeltaPill value={costDelta} suffix="vs zelfde periode vorige maand" invert />}
          spark={stats.series.slice(-7).map((p) => p.costs)}
          sparkColor={SERIES.costs}
          href="/bonnetjes"
        />
        {org.vatRegistered ? (
          <KpiCard
            label={`Te betalen btw Q${stats.q}`}
            icon={<Percent />}
            value={stats.vat.balance}
            foot={<span className="text-[12.5px] text-muted">Aangifte vóór {formatDateShort(stats.deadline)}</span>}
            href="/btw"
          />
        ) : (
          <KpiCard label="Banksaldo" icon={<Wallet />} value={balance} foot={<span className="text-[12.5px] text-muted">{pluralize(accounts.length, 'rekening', 'rekeningen')}</span>} href="/bank/rekeningen" />
        )}
      </section>

      {/* Attention + chart */}
      <section className="mt-4 grid grid-cols-1 gap-4 sm:mt-5 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Card className="overflow-hidden">
          <CardHeader title="Aandacht nodig" description={attentionItems.length ? 'Werk dit even weg en je bent bij' : undefined} />
          <div className="p-2 pt-3">
            {attentionItems.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-10 text-center">
                <div className="grid size-14 place-items-center rounded-2xl bg-success-50 text-success-600"><PartyPopper className="size-6" /></div>
                <div className="mt-4 font-display text-[16px] font-semibold">Alles is bij 🎉</div>
                <div className="mt-1 text-[13.5px] text-muted">Er staat niets meer open dat je aandacht nodig heeft.</div>
              </div>
            ) : (
              attentionItems.map((a) => (
                <Link key={a.title} href={a.href} className="group flex items-center gap-3.5 rounded-[14px] px-3.5 py-3 transition hover:bg-subtle">
                  <IconTile tone={a.tone}>{a.icon}</IconTile>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-medium text-ink">{a.title}</div>
                    <div className="truncate text-[12.5px] text-muted">{a.sub}</div>
                  </div>
                  <ChevronRight className="size-4 text-faint transition group-hover:translate-x-0.5 group-hover:text-muted" />
                </Link>
              ))
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Inkomsten en uitgaven"
            description="Per maand, exclusief btw"
            action={<Segmented size="sm" value={range} onChange={setRange} options={[{ value: '6', label: '6 mnd' }, { value: '12', label: '12 mnd' }]} />}
          />
          <div className="px-5 pt-4 sm:px-6"><Legend items={[{ label: 'Omzet', color: SERIES.income }, { label: 'Kosten', color: SERIES.costs }]} /></div>
          <div className="px-2 pb-4 pt-2 sm:px-4">
            <IncomeCostsChart data={chartData} height={260} />
          </div>
        </Card>
      </section>

      {/* Lists */}
      <section className="mt-4 grid grid-cols-1 gap-4 sm:mt-5 lg:grid-cols-2 xl:grid-cols-3 [&>*]:min-w-0">
        <Card className="xl:col-span-1">
          <CardHeader title="Openstaande facturen" action={<Link href="/facturen?filter=open" className="text-[13px] font-medium text-brand-600 hover:text-brand-700">Alles</Link>} />
          <div className="p-2 pt-3">
            {openList.length === 0 && <div className="px-4 py-8 text-center text-[13.5px] text-muted">Alles is betaald. Lekker!</div>}
            {openList.map((r) => {
              const days = daysBetween(today, r.inv.dueDate);
              return (
                <Link key={r.inv.id} href={`/facturen/${r.inv.id}`} className="flex items-center gap-3 rounded-[14px] px-3 py-2.5 transition hover:bg-subtle">
                  <Avatar name={r.customer?.companyName ?? '?'} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-medium">{r.customer?.companyName}</div>
                    <div className={cn('text-[12.5px]', days < 0 ? 'text-danger-600' : 'text-muted')}>
                      {r.inv.number} · {days < 0 ? `${-days} dagen te laat` : days === 0 ? 'vervalt vandaag' : `nog ${days} dagen`}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="tabular text-[14px] font-semibold">{formatEUR(r.due)}</div>
                    <InvoiceStatusBadge status={r.status} className="mt-0.5 h-5 px-2 text-[11px]" />
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>

        <Card>
          <CardHeader title="Recente transacties" action={<Link href="/bank" className="text-[13px] font-medium text-brand-600 hover:text-brand-700">Bank</Link>} />
          <div className="p-2 pt-3">
            {recentTx.map((t) => (
              <Link key={t.id} href={`/bank?tx=${t.id}`} className="flex items-center gap-3 rounded-[14px] px-3 py-2.5 transition hover:bg-subtle">
                <div className={cn('grid size-9 shrink-0 place-items-center rounded-[11px]', t.amount > 0 ? 'bg-success-50 text-success-600' : 'bg-subtle text-muted ring-1 ring-line')}>
                  {t.amount > 0 ? <ArrowDownRight className="size-4" /> : <ArrowUpRight className="size-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-medium">{t.counterparty}</div>
                  <div className="truncate text-[12.5px] text-muted">{formatDateShort(t.date)} · {txLabel(t, rows)}</div>
                </div>
                <Amount value={t.amount} sign colored className="text-[14px] font-semibold" />
              </Link>
            ))}
          </div>
        </Card>

        <Card className="lg:col-span-2 xl:col-span-1">
          <CardHeader title="Nog te verwerken" description="Bonnetjes en inkoopfacturen" action={<Button size="sm" variant="soft" onClick={() => openScan('receipt', true)}><Camera /> Bon</Button>} />
          <div className="p-2 pt-3">
            {toReview.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-8 text-center">
                <Sparkles className="size-6 text-brand-500" />
                <div className="mt-3 text-[14px] font-medium">Geen bonnetjes meer te verwerken 🎉</div>
              </div>
            ) : (
              toReview.map((e) => (
                <Link key={e.id} href={e.kind === 'receipt' ? `/bonnetjes?open=${e.id}` : `/inkoopfacturen?open=${e.id}`} className="flex items-center gap-3 rounded-[14px] px-3 py-2.5 transition hover:bg-subtle">
                  <DocThumb preview={e.document.previewDataUrl} mime={e.document.mimeType} className="h-11 w-9" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-medium">{e.supplierName}</div>
                    <div className="flex items-center gap-1.5 text-[12.5px] text-muted"><CategoryIcon name={e.category} className="size-3.5" />{e.category} · {formatDateShort(e.date)}</div>
                  </div>
                  <div className="tabular text-[14px] font-semibold">{formatEUR(e.total)}</div>
                </Link>
              ))
            )}
            <div className="mx-3 mt-2 flex items-center gap-2 rounded-xl bg-subtle px-3 py-2.5 text-[12.5px] text-muted ring-1 ring-line">
              <FileInput className="size-3.5 shrink-0" /> Facturen mailen naar <span className="truncate font-medium text-ink-2">{org.inboxAddress}</span>
            </div>
          </div>
        </Card>
      </section>

      {/* Quick links row */}
      <section className="mt-4 grid grid-cols-2 gap-3 sm:mt-5 sm:gap-4 lg:grid-cols-4">
        <QuickStat icon={<Clock />} label="Gem. betaaltijd" value={`${avgPayDays(rows)} dagen`} />
        <QuickStat icon={<Wallet />} label="Banksaldo" value={formatEUR(balance, { round: true })} href="/bank/rekeningen" />
        <QuickStat icon={<FileText />} label={`Facturen ${parseISODate(today).getFullYear()}`} value={String(rows.filter((r) => r.inv.issueDate.startsWith(today.slice(0, 4)) && r.inv.kind === 'invoice' && r.status !== 'draft').length)} href="/facturen" />
        <button onClick={() => setUI({ customerDrawer: { open: true } })} className="text-left">
          <QuickStat icon={<Plus />} label="Snel toevoegen" value="Nieuwe klant" />
        </button>
      </section>
    </div>
  );
}

function txLabel(t: ReturnType<typeof useTransactions>[number], rows: ReturnType<typeof useInvoiceRows>) {
  if (t.status === 'matched' && t.invoiceId) return `Factuur ${rows.find((r) => r.inv.id === t.invoiceId)?.inv.number ?? ''}`;
  if (t.status === 'matched' && t.expenseId) return 'Gekoppeld aan bon';
  if (t.status === 'categorized') return t.category ?? 'Verwerkt';
  if (t.status === 'suggested') return 'Voorstel klaar';
  if (t.status === 'ignored') return 'Genegeerd';
  return 'Nog verwerken';
}

function avgPayDays(rows: ReturnType<typeof useInvoiceRows>) {
  const paid = rows.filter((r) => r.status === 'paid' && r.inv.paidAt && r.inv.kind === 'invoice').slice(0, 30);
  if (!paid.length) return 0;
  return Math.round(paid.reduce((s, r) => s + daysBetween(r.inv.issueDate, r.inv.paidAt!), 0) / paid.length);
}

function DeltaPill({ value, suffix, invert }: { value: number; suffix: string; invert?: boolean }) {
  const up = value >= 0;
  const good = invert ? !up : up;
  return (
    <span className="flex items-center gap-1.5 text-[12.5px] text-muted">
      <span className={cn('inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11.5px] font-semibold', good ? 'bg-success-50 text-success-700' : 'bg-warning-50 text-warning-700')}>
        {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
        {Math.abs(Math.round(value))}%
      </span>
      <span className="hidden truncate sm:inline">{suffix}</span>
    </span>
  );
}

function KpiCard({
  label, icon, value, foot, spark, sparkColor, href, highlight, bar,
}: { label: string; icon: React.ReactNode; value: number; foot: React.ReactNode; spark?: number[]; sparkColor?: string; href: string; highlight?: boolean; bar?: { value: number } }) {
  return (
    <Link href={href} className="group block">
      <Card className={cn('relative h-full overflow-hidden p-4 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-raised sm:p-5', highlight && 'border-brand-100')}>
        {highlight && <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(400px_140px_at_0%_0%,rgba(108,92,244,0.09),transparent)]" />}
        <div className="relative flex items-center justify-between">
          <span className="truncate text-[13px] font-medium text-muted first-letter:uppercase">{label}</span>
          <span className="hidden size-7 place-items-center rounded-lg bg-subtle text-muted ring-1 ring-line sm:grid [&_svg]:size-3.5">{icon}</span>
        </div>
        <div className="relative mt-2.5 font-display text-[24px] font-bold leading-none tracking-[-0.03em] sm:mt-3 sm:text-[32px]">
          <AnimatedNumber value={value} />
        </div>
        <div className="relative mt-3 flex min-h-[22px] items-end justify-between gap-3">
          <div className="min-w-0">{foot}</div>
          {spark && <div className="hidden h-8 w-20 shrink-0 sm:block"><Sparkline values={spark} color={sparkColor} height={32} /></div>}
        </div>
        {bar && (
          <div className="relative mt-3 flex h-1.5 overflow-hidden rounded-full bg-danger-100" title="Binnen termijn / verlopen">
            <div className="h-full rounded-full bg-brand-500" style={{ width: `${bar.value}%` }} />
          </div>
        )}
      </Card>
    </Link>
  );
}

function QuickStat({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: string; href?: string }) {
  const inner = (
    <Card className="flex h-full items-center gap-3 p-4 transition hover:shadow-raised">
      <IconTile>{icon}</IconTile>
      <div className="min-w-0">
        <div className="truncate text-[12.5px] text-muted">{label}</div>
        <div className="tabular truncate font-display text-[16px] font-semibold">{value}</div>
      </div>
    </Card>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

