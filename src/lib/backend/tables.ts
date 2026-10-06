import type { AppData } from '../types';

/** Store collections that live in their own table (one JSON document per row). */
export const ENTITY_TABLES = {
  customers: 'customers',
  suppliers: 'suppliers',
  products: 'products',
  categories: 'categories',
  invoices: 'invoices',
  quotes: 'quotes',
  recurring: 'recurring_invoices',
  expenses: 'expenses',
  bankAccounts: 'bank_accounts',
  transactions: 'bank_transactions',
  notifications: 'notifications',
  emailLogs: 'email_logs',
} as const satisfies Partial<Record<keyof AppData, string>>;

export type EntityKey = keyof typeof ENTITY_TABLES;
export const ENTITY_KEYS = Object.keys(ENTITY_TABLES) as EntityKey[];

export interface Row {
  id: string;
  organization_id?: string;
  data: unknown;
}
