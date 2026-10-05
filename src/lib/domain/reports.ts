import type { Expense, Invoice } from '../types';
import { documentTotals } from './calc';
import { round2 } from './money';
import { formatMonthShort } from './dates';

export interface MonthPoint {
  key: string;
  label: string;
  revenue: number;
  costs: number;
  result: number;
}

/** Revenue (excl. btw, by invoice date) and costs (excl. btw) per month. */
export function monthlySeries(invoices: Invoice[], expenses: Expense[], from: string, to: string): MonthPoint[] {
  const points = new Map<string, MonthPoint>();
  const start = new Date(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 1, 1);
  const end = new Date(Number(to.slice(0, 4)), Number(to.slice(5, 7)) - 1, 1);
  const multiYear = start.getFullYear() !== end.getFullYear();
  for (const d = new Date(start); d <= end; d.setMonth(d.getMonth() + 1)) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = formatMonthShort(d.getMonth()) + (multiYear ? ` '${String(d.getFullYear()).slice(2)}` : '');
    points.set(key, { key, label, revenue: 0, costs: 0, result: 0 });
  }
  for (const inv of invoices) {
    if (inv.state === 'draft' || inv.issueDate < from || inv.issueDate > to) continue;
    const p = points.get(inv.issueDate.slice(0, 7));
    if (p) p.revenue += documentTotals(inv.lines).subtotal;
  }
  for (const e of expenses) {
    if (e.date < from || e.date > to) continue;
    const p = points.get(e.date.slice(0, 7));
    if (p) p.costs += e.subtotal;
  }
  return [...points.values()].map((p) => ({
    ...p,
    revenue: round2(p.revenue),
    costs: round2(p.costs),
    result: round2(p.revenue - p.costs),
  }));
}

export function costsByCategory(expenses: Expense[], from: string, to: string) {
  const m = new Map<string, number>();
  for (const e of expenses) {
    if (e.date < from || e.date > to) continue;
    m.set(e.category, (m.get(e.category) ?? 0) + e.subtotal);
  }
  return [...m.entries()].map(([category, amount]) => ({ category, amount: round2(amount) })).sort((a, b) => b.amount - a.amount);
}

/** Percentage change, or null when there is no base to compare with. */
export function delta(current: number, previous: number): number | null {
  if (Math.abs(previous) < 0.01) return null;
  return round2(((current - previous) / Math.abs(previous)) * 100);
}
