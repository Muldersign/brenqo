import 'server-only';
import { createStore } from 'zustand/vanilla';
import { createActions, pickData, type Store } from '../store/core';
import type { EmailLog } from '../types';
import { loadOrganizationData, saveChanges } from './docs';
import { mailConfigured, sendInvoiceMail } from './mailer';
import { notifyOrganization } from './push';

/**
 * The daily job for one administration: recurring invoices, payment reminders
 * and bank matching — the exact same code the app runs (store/core.ts).
 * New e-mails it records are then actually sent.
 */
export async function runOrganizationAutomations(organizationId: string, baseUrl: string) {
  const data = await loadOrganizationData(organizationId);
  const store = createStore<Store>()((set, get) => ({ ...data, ...createActions(set, get) }));
  const before = pickData(store.getState());
  const result = store.getState().runAutomations();
  const after = pickData(store.getState());
  await saveChanges(before, after);

  const known = new Set(before.emailLogs.map((m) => m.id));
  const fresh = after.emailLogs.filter((m) => !known.has(m.id));
  const sent: EmailLog[] = [];
  const failed: string[] = [];
  if (mailConfigured()) {
    const org = after.organizations[0];
    for (const mail of fresh) {
      const inv = after.invoices.find((i) => i.id === mail.invoiceId);
      if (!inv || !mail.to) continue;
      try {
        await sendInvoiceMail(baseUrl, org, after.customers.find((c) => c.id === inv.customerId), inv, mail);
        sent.push(mail);
      } catch (e) {
        failed.push(`${mail.subject}: ${e instanceof Error ? e.message : e}`);
      }
    }
  }
  if (result.recurring || result.reminders || result.matched) {
    const parts = [
      result.recurring && `${result.recurring} periodieke factuur/facturen`,
      result.reminders && `${result.reminders} herinnering(en)`,
      result.matched && `${result.matched} betaling(en) gekoppeld`,
    ].filter(Boolean);
    await notifyOrganization(organizationId, { title: 'Brenqo heeft vandaag werk gedaan', body: parts.join(' · '), url: '/' }).catch(() => {});
  }
  return { ...result, emailsSent: sent.length, emailsFailed: failed };
}
