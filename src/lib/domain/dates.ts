import type { ISODate } from '../types';

export function toISODate(d: Date): ISODate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseISODate(s: ISODate): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO(): ISODate {
  return toISODate(new Date());
}

export function addDays(date: ISODate, days: number): ISODate {
  const d = parseISODate(date);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function addMonths(date: ISODate, months: number): ISODate {
  const d = parseISODate(date);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return toISODate(d);
}

/** Whole days from `a` to `b` (positive when b is later). */
export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86_400_000);
}

const long = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
const short = new Intl.DateTimeFormat('nl-NL', { day: '2-digit', month: 'short' });
const medium = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
const monthName = new Intl.DateTimeFormat('nl-NL', { month: 'long' });
const monthShort = new Intl.DateTimeFormat('nl-NL', { month: 'short' });

/** 5 oktober 2026 */
export const formatDateLong = (s: ISODate) => long.format(parseISODate(s));
/** 05 okt */
export const formatDateShort = (s: ISODate) => short.format(parseISODate(s)).replace('.', '');
/** 5 okt 2026 */
export const formatDate = (s: ISODate) => medium.format(parseISODate(s)).replace('.', '');
export const formatMonth = (monthIndex: number) => monthName.format(new Date(2026, monthIndex, 1));
export const formatMonthShort = (monthIndex: number) => monthShort.format(new Date(2026, monthIndex, 1)).replace('.', '');

export function relativeDay(date: ISODate, today: ISODate): string {
  const diff = daysBetween(today, date);
  if (diff === 0) return 'vandaag';
  if (diff === 1) return 'morgen';
  if (diff === -1) return 'gisteren';
  if (diff > 1) return `over ${diff} dagen`;
  return `${-diff} dagen geleden`;
}

export function relativeTime(iso: string, now = new Date()): string {
  const t = new Date(iso).getTime();
  const mins = Math.round((now.getTime() - t) / 60_000);
  if (mins < 1) return 'zojuist';
  if (mins < 60) return `${mins} min geleden`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} uur geleden`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'gisteren';
  if (days < 7) return `${days} dagen geleden`;
  return formatDate(iso.slice(0, 10));
}

export const quarterOf = (date: ISODate) => Math.floor((parseISODate(date).getMonth()) / 3) + 1;
export const yearOf = (date: ISODate) => Number(date.slice(0, 4));
export const monthOf = (date: ISODate) => Number(date.slice(5, 7)) - 1;

export function inRange(date: ISODate, from: ISODate, to: ISODate) {
  return date >= from && date <= to;
}
