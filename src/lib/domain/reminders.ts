import type { Customer, Invoice, Organization, ReminderStep } from '../types';
import { addDays } from './dates';
import { invoiceStatus } from './status';

/** The next reminder step that should go out today (or earlier), if any. */
export function dueReminderStep(
  inv: Invoice,
  org: Organization,
  customer: Customer | undefined,
  today: string,
): ReminderStep | null {
  if (!org.reminders.enabled || !inv.remindersEnabled) return null;
  if (customer && !customer.remindersEnabled) return null;
  if (invoiceStatus(inv, today) !== 'overdue') return null;
  const sent = new Set(inv.remindersSent.map((r) => r.stepId));
  const steps = org.reminders.steps.filter((s) => s.enabled).sort((a, b) => a.daysAfterDue - b.daysAfterDue);
  let candidate: ReminderStep | null = null;
  for (const s of steps) {
    if (sent.has(s.id)) continue;
    if (addDays(inv.dueDate, s.daysAfterDue) <= today) candidate = s;
    else break;
  }
  return candidate;
}

/** Timeline for the invoice detail page: when each reminder goes (or went) out. */
export function reminderPlan(inv: Invoice, org: Organization) {
  const sent = new Map(inv.remindersSent.map((r) => [r.stepId, r.sentAt]));
  return org.reminders.steps
    .filter((s) => s.enabled)
    .sort((a, b) => a.daysAfterDue - b.daysAfterDue)
    .map((s) => ({ step: s, date: addDays(inv.dueDate, s.daysAfterDue), sentAt: sent.get(s.id) }));
}
