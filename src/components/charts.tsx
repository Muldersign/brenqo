'use client';

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell, ReferenceLine } from 'recharts';
import type { MonthPoint } from '@/lib/domain/reports';
import { formatEUR } from '@/lib/domain/money';

/** Chart roles. Validated: CVD ΔE 35 between the two series; legend + tooltip carry identity. */
export const SERIES = { income: '#5b4bf5', costs: '#eb6834', grid: '#efeff3', axis: '#a2a2ad' };

const compactEUR = (n: number) => (Math.abs(n) >= 1000 ? `€${(n / 1000).toLocaleString('nl-NL', { maximumFractionDigits: 1 })}k` : `€${Math.round(n)}`);

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string; dataKey: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[170px] rounded-2xl border border-line bg-surface/95 p-3 shadow-pop backdrop-blur">
      <div className="mb-2 text-[12px] font-semibold capitalize text-muted">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 py-0.5 text-[13px]">
          <span className="flex items-center gap-2 text-ink-2"><span className="size-2 rounded-full" style={{ background: p.color }} />{p.name}</span>
          <span className="tabular font-semibold text-ink">{formatEUR(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex items-center gap-4 text-[12.5px] text-ink-2">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: i.color }} />{i.label}</span>
      ))}
    </div>
  );
}

export function IncomeCostsChart({ data, height = 280 }: { data: MonthPoint[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} barGap={2} barCategoryGap="28%" margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={SERIES.grid} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: SERIES.axis, fontSize: 12 }} dy={6} />
        <YAxis tickLine={false} axisLine={false} tick={{ fill: SERIES.axis, fontSize: 12 }} tickFormatter={compactEUR} width={56} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(91,75,245,0.05)', radius: 8 }} />
        <Bar dataKey="revenue" name="Omzet" fill={SERIES.income} radius={[4, 4, 0, 0]} maxBarSize={22} />
        <Bar dataKey="costs" name="Kosten" fill={SERIES.costs} radius={[4, 4, 0, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function RevenueAreaChart({ data, height = 280, dataKey = 'revenue', name = 'Omzet' }: { data: MonthPoint[]; height?: number; dataKey?: 'revenue' | 'costs'; name?: string }) {
  const color = dataKey === 'revenue' ? SERIES.income : SERIES.costs;
  const id = `area-${dataKey}`;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={SERIES.grid} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: SERIES.axis, fontSize: 12 }} dy={6} />
        <YAxis tickLine={false} axisLine={false} tick={{ fill: SERIES.axis, fontSize: 12 }} tickFormatter={compactEUR} width={56} />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#d3cffe', strokeWidth: 1 }} />
        <Area type="monotone" dataKey={dataKey} name={name} stroke={color} strokeWidth={2} fill={`url(#${id})`} activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Result per month: one series; months with a loss are drawn lighter and below the zero line. */
export function ResultChart({ data, height = 240 }: { data: MonthPoint[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }} barCategoryGap="30%">
        <CartesianGrid vertical={false} stroke={SERIES.grid} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: SERIES.axis, fontSize: 12 }} dy={6} />
        <YAxis tickLine={false} axisLine={false} tick={{ fill: SERIES.axis, fontSize: 12 }} tickFormatter={compactEUR} width={56} />
        <ReferenceLine y={0} stroke="#d6d6de" />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(91,75,245,0.05)', radius: 8 }} />
        <Bar dataKey="result" name="Resultaat" radius={[4, 4, 4, 4]} maxBarSize={28}>
          {data.map((d) => <Cell key={d.key} fill={d.result >= 0 ? SERIES.income : '#b2aafc'} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Sparkline({ values, color = SERIES.income, height = 40 }: { values: number[]; color?: string; height?: number }) {
  const data = values.map((v, i) => ({ i, v }));
  const id = `spark-${color.replace('#', '')}`;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.18} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#${id})`} isAnimationActive={false} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function CategoryBars({ data }: { data: { category: string; amount: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.amount));
  const total = data.reduce((s, d) => s + d.amount, 0) || 1;
  return (
    <div className="space-y-3.5">
      {data.map((d) => (
        <div key={d.category} className="group">
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="truncate font-medium text-ink-2">{d.category}</span>
            <span className="tabular shrink-0 text-ink"><span className="mr-2 text-[12px] text-faint">{Math.round((d.amount / total) * 100)}%</span>{formatEUR(d.amount)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#f0f0f4]">
            <div className="h-full rounded-full bg-brand-500 transition-[width] duration-700 group-hover:bg-brand-600" style={{ width: `${(d.amount / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
