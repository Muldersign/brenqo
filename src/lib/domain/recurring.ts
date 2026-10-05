import type { Frequency, ISODate } from '../types';
import { addMonths } from './dates';

export const frequencyLabel: Record<Frequency, string> = {
  monthly: 'Maandelijks',
  quarterly: 'Per kwartaal',
  yearly: 'Jaarlijks',
};

export const frequencyShort: Record<Frequency, string> = {
  monthly: 'per maand',
  quarterly: 'per kwartaal',
  yearly: 'per jaar',
};

export function nextOccurrence(date: ISODate, freq: Frequency): ISODate {
  return addMonths(date, freq === 'monthly' ? 1 : freq === 'quarterly' ? 3 : 12);
}

/** All run dates from `nextDate` up to and including `today`. */
export function dueRuns(nextDate: ISODate, freq: Frequency, today: ISODate, endDate?: ISODate): ISODate[] {
  const out: ISODate[] = [];
  let d = nextDate;
  while (d <= today && (!endDate || d <= endDate) && out.length < 24) {
    out.push(d);
    d = nextOccurrence(d, freq);
  }
  return out;
}

/** Normalised yearly value, e.g. €25 per maand → €300. */
export function yearlyValue(amount: number, freq: Frequency) {
  return amount * (freq === 'monthly' ? 12 : freq === 'quarterly' ? 4 : 1);
}
