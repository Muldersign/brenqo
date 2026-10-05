'use client';

import { useMemo } from 'react';
import { useExpenses, useInvoiceRows, useTransactions } from '@/lib/store';

/** Counts that drive the sidebar badges and the "Aandacht nodig" card. */
export function useAttention() {
  const rows = useInvoiceRows();
  const expenses = useExpenses();
  const transactions = useTransactions();
  return useMemo(() => {
    const overdue = rows.filter((r) => r.status === 'overdue');
    const unpaid = rows.filter((r) => ['sent', 'viewed', 'open', 'partial'].includes(r.status));
    const drafts = rows.filter((r) => r.status === 'draft');
    const receipts = expenses.filter((e) => e.status === 'review' && e.kind === 'receipt');
    const purchase = expenses.filter((e) => e.status === 'review' && e.kind === 'invoice');
    const bank = transactions.filter((t) => t.status === 'todo' || t.status === 'suggested');
    const suggestions = transactions.filter((t) => t.status === 'suggested');
    return {
      overdue, unpaid, drafts, receipts, purchase, bank, suggestions,
      counts: { overdue: overdue.length, receipts: receipts.length, expenses: purchase.length, bank: bank.length },
    };
  }, [rows, expenses, transactions]);
}
