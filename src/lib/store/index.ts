'use client';

import { useMemo } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AppData } from '../types';
import { createDemoData } from '../demo-data';
import { amountDue, documentTotals } from '../domain/calc';
import { todayISO } from '../domain/dates';
import { invoiceStatus } from '../domain/status';
import { createActions, pickData, type Store } from './core';

export type { Store, SendPayload, PaymentInput } from './core';

/** Quota-safe localStorage: a full disk should never break the app. */
const safeStorage = createJSONStorage(() => ({
  getItem: (k: string) => {
    try { return localStorage.getItem(k); } catch { return null; }
  },
  setItem: (k: string, v: string) => {
    try { localStorage.setItem(k, v); } catch (e) { console.warn('Brenqo: opslaan in browser mislukt', e); }
  },
  removeItem: (k: string) => {
    try { localStorage.removeItem(k); } catch { /* ignore */ }
  },
}));

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      ...createDemoData(),
      ...createActions(set, get),
    }),
    {
      name: 'brenqo-data',
      version: 1,
      storage: safeStorage,
      partialize: (s): AppData => pickData(s),
    },
  ),
);

/* ───────────── Selectors (always scoped to the active administration) ───────────── */

export const useOrg = () => useStore((s) => s.organizations.find((o) => o.id === s.activeOrgId) ?? s.organizations[0]);

function useScoped<K extends 'customers' | 'suppliers' | 'products' | 'invoices' | 'quotes' | 'categories' | 'expenses' | 'bankAccounts' | 'transactions' | 'recurring' | 'notifications' | 'emailLogs' | 'members'>(key: K): AppData[K] {
  const all = useStore((s) => s[key]);
  const orgId = useStore((s) => s.activeOrgId);
  return useMemo(() => (all as { organizationId: string }[]).filter((x) => x.organizationId === orgId) as AppData[K], [all, orgId]);
}

export const useCustomers = () => useScoped('customers');
export const useSuppliers = () => useScoped('suppliers');
export const useProducts = () => useScoped('products');
export const useInvoices = () => useScoped('invoices');
export const useQuotes = () => useScoped('quotes');
export const useCategories = () => useScoped('categories');
export const useExpenses = () => useScoped('expenses');
export const useBankAccounts = () => useScoped('bankAccounts');
export const useTransactions = () => useScoped('transactions');
export const useRecurring = () => useScoped('recurring');
export const useNotifications = () => useScoped('notifications');
export const useEmailLogs = () => useScoped('emailLogs');
export const useMembers = () => useScoped('members');

export function useCustomerMap() {
  const customers = useCustomers();
  return useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);
}

/** Invoices enriched with derived status and totals — what most screens need. */
export function useInvoiceRows() {
  const invoices = useInvoices();
  const customers = useCustomerMap();
  const today = todayISO();
  return useMemo(
    () =>
      invoices
        .map((inv) => ({
          inv,
          customer: customers.get(inv.customerId),
          status: invoiceStatus(inv, today),
          total: documentTotals(inv.lines).total,
          due: amountDue(inv),
        }))
        .sort((a, b) => (b.inv.number || 'zzzz').localeCompare(a.inv.number || 'zzzz') || b.inv.createdAt.localeCompare(a.inv.createdAt)),
    [invoices, customers, today],
  );
}
export type InvoiceRow = ReturnType<typeof useInvoiceRows>[number];

