import { describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { diffData } from './diff';
import { createDemoData } from '../demo-data';
import { createActions, pickData, type Store } from '../store/core';

function store() {
  return createStore<Store>()((set, get) => ({ ...createDemoData('2026-10-05'), ...createActions(set, get) }));
}

describe('sync diff', () => {
  it('finds nothing when nothing changed', () => {
    const s = store();
    const a = pickData(s.getState());
    expect(diffData(a, pickData(s.getState()))).toEqual([]);
  });

  it('upserts exactly the records an action touched, organizations first', () => {
    const s = store();
    const before = pickData(s.getState());
    const id = s.getState().saveCustomer({ companyName: 'Nieuwe Klant BV' });
    s.getState().finalizeInvoice(s.getState().invoices.find((i) => i.state === 'draft' && i.organizationId === 'org_muldersign')!.id);
    const changes = diffData(before, pickData(s.getState()));
    expect(changes.map((c) => c.table)).toEqual(['organizations', 'customers', 'invoices']);
    expect(changes[0].upserts.map((u) => u.id)).toEqual(['org_muldersign']); // next invoice number
    expect(changes[1].upserts).toEqual([expect.objectContaining({ id, organization_id: 'org_muldersign' })]);
    expect(changes[2].upserts).toHaveLength(1);
  });

  it('reports deletions', () => {
    const s = store();
    const before = pickData(s.getState());
    const draft = s.getState().invoices.find((i) => i.state === 'draft')!;
    s.getState().deleteInvoices([draft.id]);
    const [c] = diffData(before, pickData(s.getState()));
    expect(c).toMatchObject({ table: 'invoices', upserts: [], deletes: [draft.id] });
  });

  it('runs the same automations on the server as in the browser', () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 5, 12), toFake: ['Date'] });
    try {
      const s = store();
      const before = pickData(s.getState());
      // Demo data is consistent for its own date: nothing due, nothing written.
      expect(s.getState().runAutomations({ matching: false })).toMatchObject({ reminders: 0, recurring: 0 });
      expect(diffData(before, pickData(s.getState()))).toEqual([]);
      // A week later the overdue invoices get their next reminder, and only those records change.
      vi.setSystemTime(new Date(2026, 9, 12, 12));
      const r = s.getState().runAutomations({ matching: false });
      expect(r.reminders).toBeGreaterThan(0);
      const tables = diffData(before, pickData(s.getState())).map((c) => c.table);
      expect(tables).toEqual(expect.arrayContaining(['invoices', 'email_logs', 'notifications']));
      expect(tables).not.toContain('customers');
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignores a repeated webhook for the same payment', () => {
    const s = store();
    const inv = s.getState().invoices.find((i) => i.number === '2026-035')!;
    const pay = { date: '2026-10-06', amount: 847, method: 'ideal' as const, source: 'online' as const, providerPaymentId: 'tr_123' };
    s.getState().registerPayment(inv.id, pay);
    s.getState().registerPayment(inv.id, pay);
    const after = s.getState().invoices.find((i) => i.id === inv.id)!;
    expect(after.payments).toHaveLength(1);
    expect(after.state).toBe('paid');
  });
});
