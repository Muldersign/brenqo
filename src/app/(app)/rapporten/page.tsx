'use client';

import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { useExpenses, useInvoiceRows, useInvoices } from '@/lib/store';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AnimatedNumber, PageHeader, Segmented } from '@/components/ui/misc';
import { Input } from '@/components/ui/input';
import { CategoryBars, IncomeCostsChart, Legend, ResultChart, RevenueAreaChart, SERIES } from '@/components/charts';
import { costsByCategory, delta, monthlySeries } from '@/lib/domain/reports';
import { formatEUR } from '@/lib/domain/money';
import { parseISODate, toISODate, todayISO } from '@/lib/domain/dates';
import { isOutstanding } from '@/lib/domain/status';
import { cn } from '@/lib/utils';

type Range = 'year' | 'lastYear' | 'month' | 'lastQuarter' | 'custom';

function rangeFor(r: Range, today: string, custom: { from: string; to: string }) {
  const d = parseISODate(today);
  const y = d.getFullYear();
  if (r === 'year') return { from: `${y}-01-01`, to: today, prev: { from: `${y - 1}-01-01`, to: `${y - 1}${today.slice(4)}` } };
  if (r === 'lastYear') return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31`, prev: { from: `${y - 2}-01-01`, to: `${y - 2}-12-31` } };
  if (r === 'month') {
    const from = toISODate(new Date(y, d.getMonth(), 1));
    return { from, to: today, prev: { from: toISODate(new Date(y, d.getMonth() - 1, 1)), to: toISODate(new Date(y, d.getMonth(), 0)) } };
  }
  if (r === 'lastQuarter') {
    const q = Math.floor(d.getMonth() / 3);
    const from = toISODate(new Date(y, (q - 1) * 3, 1));
    const to = toISODate(new Date(y, q * 3, 0));
    return { from, to, prev: { from: toISODate(new Date(y, (q - 2) * 3, 1)), to: toISODate(new Date(y, (q - 1) * 3, 0)) } };
  }
  return { ...custom, prev: { from: custom.from, to: custom.from } };
}

export default function ReportsPage() {
  const invoices = useInvoices();
  const expenses = useExpenses();
  const rows = useInvoiceRows();
  const today = todayISO();
  const [range, setRange] = useState<Range>('year');
  const [custom, setCustom] = useState({ from: `${today.slice(0, 4)}-01-01`, to: today });
  const r = rangeFor(range, today, custom);

  const data = useMemo(() => {
    const series = monthlySeries(invoices, expenses, r.from, r.to);
    const prev = monthlySeries(invoices, expenses, r.prev.from, r.prev.to);
    const sum = (s: typeof series, k: 'revenue' | 'costs' | 'result') => s.reduce((a, p) => a + p[k], 0);
    return {
      series,
      revenue: sum(series, 'revenue'), costs: sum(series, 'costs'), result: sum(series, 'result'),
      prevRevenue: sum(prev, 'revenue'), prevCosts: sum(prev, 'costs'), prevResult: sum(prev, 'result'),
      categories: costsByCategory(expenses, r.from, r.to).slice(0, 8),
    };
  }, [invoices, expenses, r.from, r.to, r.prev.from, r.prev.to]);

  const outstanding = rows.filter((x) => isOutstanding(x.status)).reduce((s, x) => s + x.due, 0);
  const topCustomers = useMemo(() => {
    const m = new Map<string, number>();
    rows.filter((x) => x.status !== 'draft' && x.status !== 'credited' && x.inv.issueDate >= r.from && x.inv.issueDate <= r.to).forEach((x) => m.set(x.customer?.companyName ?? '?', (m.get(x.customer?.companyName ?? '?') ?? 0) + x.total));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [rows, r.from, r.to]);

  function exportCsv() {
    const lines = ['Maand;Omzet excl. btw;Kosten excl. btw;Resultaat', ...data.series.map((p) => `${p.key};${p.revenue.toFixed(2).replace('.', ',')};${p.costs.toFixed(2).replace('.', ',')};${p.result.toFixed(2).replace('.', ',')}`)];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `brenqo-rapport-${r.from}-${r.to}.csv`;
    a.click();
  }

  const margin = data.revenue ? Math.round((data.result / data.revenue) * 100) : 0;

  return (
    <div className="animate-fade-in">
      <PageHeader title="Omzet en kosten" description="Hoe gaat het met je bedrijf? Alle bedragen exclusief btw." actions={<Button variant="outline" onClick={exportCsv}><Download /> Exporteren</Button>} />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Segmented value={range} onChange={setRange} options={[
          { value: 'year', label: 'Dit jaar' }, { value: 'lastYear', label: 'Vorig jaar' }, { value: 'month', label: 'Deze maand' },
          { value: 'lastQuarter', label: 'Vorig kwartaal' }, { value: 'custom', label: 'Aangepast' },
        ]} />
        {range === 'custom' && (
          <div className="flex items-center gap-2">
            <Input type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} className="w-[160px]" />
            <span className="text-muted">t/m</span>
            <Input type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} className="w-[160px]" />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat label="Omzet" value={data.revenue} d={range === 'custom' ? null : delta(data.revenue, data.prevRevenue)} />
        <Stat label="Kosten" value={data.costs} d={range === 'custom' ? null : delta(data.costs, data.prevCosts)} invert />
        <Stat label="Resultaat" value={data.result} d={range === 'custom' ? null : delta(data.result, data.prevResult)} sub={`${margin}% van je omzet`} />
        <Stat label="Openstaand" value={outstanding} sub="Nu nog te ontvangen" />
      </div>

      <div className="mt-4 grid gap-4 sm:mt-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="Omzet per maand" />
          <div className="px-2 pb-4 pt-4 sm:px-4"><RevenueAreaChart data={data.series} height={250} /></div>
        </Card>
        <Card>
          <CardHeader title="Kosten per maand" />
          <div className="px-2 pb-4 pt-4 sm:px-4"><RevenueAreaChart data={data.series} dataKey="costs" name="Kosten" height={250} /></div>
        </Card>
        <Card>
          <CardHeader title="Resultaat per maand" description="Omzet min kosten" />
          <div className="px-2 pb-4 pt-4 sm:px-4"><ResultChart data={data.series} height={250} /></div>
        </Card>
        <Card>
          <CardHeader title="Inkomsten en uitgaven" />
          <div className="px-5 pt-4 sm:px-6"><Legend items={[{ label: 'Omzet', color: SERIES.income }, { label: 'Kosten', color: SERIES.costs }]} /></div>
          <div className="px-2 pb-4 pt-2 sm:px-4"><IncomeCostsChart data={data.series} height={230} /></div>
        </Card>
        <Card>
          <CardHeader title="Waar gaat je geld naartoe?" description="Kosten per categorie" />
          <div className="p-5 sm:p-6">{data.categories.length ? <CategoryBars data={data.categories} /> : <div className="py-6 text-center text-[13.5px] text-muted">Geen kosten in deze periode</div>}</div>
        </Card>
        <Card>
          <CardHeader title="Beste klanten" description="Omzet incl. btw in deze periode" />
          <ul className="p-5 sm:p-6">
            {topCustomers.map(([name, amount], i) => (
              <li key={name} className="flex items-center gap-3 border-b border-line/70 py-2.5 last:border-0">
                <span className="grid size-6 place-items-center rounded-full bg-subtle text-[12px] font-semibold text-muted ring-1 ring-line">{i + 1}</span>
                <span className="flex-1 truncate text-[14px] font-medium">{name}</span>
                <span className="tabular text-[14px] font-semibold">{formatEUR(amount)}</span>
              </li>
            ))}
            {topCustomers.length === 0 && <div className="py-6 text-center text-[13.5px] text-muted">Nog geen omzet in deze periode</div>}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, d, invert, sub }: { label: string; value: number; d?: number | null; invert?: boolean; sub?: string }) {
  const good = d === null || d === undefined ? true : invert ? d <= 0 : d >= 0;
  return (
    <Card className="p-4 sm:p-5">
      <div className="text-[13px] font-medium text-muted">{label}</div>
      <div className="mt-2 font-display text-[22px] font-bold tracking-[-0.03em] sm:text-[28px]"><AnimatedNumber value={value} /></div>
      <div className="mt-1.5 text-[12.5px] text-muted">
        {d !== null && d !== undefined ? <span className={cn('font-semibold', good ? 'text-success-600' : 'text-warning-700')}>{d >= 0 ? '+' : ''}{Math.round(d)}% </span> : null}
        {d !== null && d !== undefined ? 'vs vorige periode' : sub}
      </div>
    </Card>
  );
}
