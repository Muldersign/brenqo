'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import { Dialog } from 'radix-ui';
import { ArrowLeftRight, FileText, Receipt, Search, User, FilePenLine, CornerDownLeft, Truck, Plus, Camera } from 'lucide-react';
import { useCustomers, useExpenses, useInvoiceRows, useQuotes, useSuppliers, useTransactions, useCustomerMap } from '@/lib/store';
import { useUI } from '@/lib/store/ui';
import { formatEUR, parseAmount } from '@/lib/domain/money';
import { formatDate } from '@/lib/domain/dates';
import { normalize } from '@/lib/utils';
import { InvoiceStatusBadge } from '@/components/ui/badge';
import { documentTotals } from '@/lib/domain/calc';
import { Kbd } from '@/components/ui/misc';

function amountMatches(q: string, amount: number) {
  const n = parseAmount(q);
  if (!n || !/\d/.test(q)) return false;
  return Math.abs(Math.abs(amount) - n) < 0.005 || formatEUR(Math.abs(amount)).replace(/\s/g, '').includes(q.replace(/\s/g, ''));
}

export function CommandSearch() {
  const open = useUI((s) => s.searchOpen);
  const setOpen = useUI((s) => s.setSearchOpen);
  const openScan = useUI((s) => s.openScan);
  const router = useRouter();
  const [q, setQ] = useState('');
  const customers = useCustomers();
  const rows = useInvoiceRows();
  const quotes = useQuotes();
  const expenses = useExpenses();
  const transactions = useTransactions();
  const suppliers = useSuppliers();
  const customerMap = useCustomerMap();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(!useUI.getState().searchOpen);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);

  const results = useMemo(() => {
    const query = q.trim();
    if (!query) return null;
    const nq = normalize(query);
    const text = (s: string) => normalize(s).includes(nq);
    return {
      customers: customers.filter((c) => text(c.companyName) || text(c.contactName) || text(c.email)).slice(0, 5),
      invoices: rows.filter((r) => text(r.inv.number) || (r.customer && text(r.customer.companyName)) || text(r.inv.reference) || amountMatches(query, r.total)).slice(0, 6),
      quotes: quotes.filter((x) => text(x.number) || text(customerMap.get(x.customerId)?.companyName ?? '') || amountMatches(query, documentTotals(x.lines).total)).slice(0, 4),
      expenses: expenses.filter((e) => text(e.supplierName) || text(e.description) || text(e.category) || amountMatches(query, e.total)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5),
      transactions: transactions.filter((t) => text(t.counterparty) || text(t.description) || amountMatches(query, t.amount)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5),
      suppliers: suppliers.filter((s) => text(s.name)).slice(0, 3),
    };
  }, [q, customers, rows, quotes, expenses, transactions, suppliers, customerMap]);

  const go = (href: string) => {
    setOpen(false);
    setQ('');
    router.push(href);
  };

  const itemCls = 'flex cursor-pointer items-center gap-3 rounded-[12px] px-3 py-2.5 text-[13.5px] text-ink-2 data-[selected=true]:bg-black/[0.045] data-[selected=true]:text-ink';
  const groupCls = '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-faint';
  const icon = (node: React.ReactNode) => <div className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-subtle text-muted ring-1 ring-line [&_svg]:size-4">{node}</div>;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#17171c]/30 backdrop-blur-[3px]" />
        <Dialog.Content className="fixed inset-x-3 top-[max(12px,env(safe-area-inset-top))] z-50 mx-auto max-w-[640px] overflow-hidden rounded-[22px] border border-line bg-surface shadow-pop outline-none sm:top-[12vh] data-[state=open]:animate-[fade-in_0.2s_ease-out]">
          <Dialog.Title className="sr-only">Zoeken</Dialog.Title>
          <Dialog.Description className="sr-only">Zoek in klanten, facturen, bonnetjes en transacties</Dialog.Description>
          <Command shouldFilter={false} loop>
            <div className="flex items-center gap-3 border-b border-line px-5">
              <Search className="size-[18px] text-muted" />
              <Command.Input
                value={q}
                onValueChange={setQ}
                placeholder="Zoek klant, factuurnummer, bedrag of leverancier…"
                className="h-14 flex-1 bg-transparent text-[16px] outline-none placeholder:text-faint"
              />
              <Kbd>esc</Kbd>
            </div>
            <Command.List className="max-h-[min(60vh,520px)] overflow-y-auto p-2">
              {!results && (
                <Command.Group heading="Snel naar" className={groupCls}>
                  <Command.Item className={itemCls} onSelect={() => go('/facturen/nieuw')}>{icon(<Plus />)}Nieuwe factuur</Command.Item>
                  <Command.Item className={itemCls} onSelect={() => { setOpen(false); openScan('receipt', true); }}>{icon(<Camera />)}Bon toevoegen</Command.Item>
                  <Command.Item className={itemCls} onSelect={() => go('/facturen?filter=overdue')}>{icon(<FileText />)}Verlopen facturen</Command.Item>
                  <Command.Item className={itemCls} onSelect={() => go('/bank')}>{icon(<ArrowLeftRight />)}Transacties controleren</Command.Item>
                  <Command.Item className={itemCls} onSelect={() => go('/btw')}>{icon(<Receipt />)}Btw-overzicht</Command.Item>
                </Command.Group>
              )}
              {results && (
                <Command.Empty className="px-6 py-14 text-center text-[14px] text-muted">
                  Niets gevonden voor “{q}”.
                </Command.Empty>
              )}
              {results && results.customers.length > 0 && (
                <Command.Group heading="Klanten" className={groupCls}>
                  {results.customers.map((c) => (
                    <Command.Item key={c.id} value={`c-${c.id}`} className={itemCls} onSelect={() => go(`/klanten/${c.id}`)}>
                      {icon(<User />)}
                      <span className="flex-1 truncate"><span className="text-muted">Klant</span> {c.companyName}</span>
                      <span className="text-[12px] text-faint">{c.city}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {results && results.invoices.length > 0 && (
                <Command.Group heading="Facturen" className={groupCls}>
                  {results.invoices.map((r) => (
                    <Command.Item key={r.inv.id} value={`i-${r.inv.id}`} className={itemCls} onSelect={() => go(`/facturen/${r.inv.id}`)}>
                      {icon(<FileText />)}
                      <span className="flex-1 truncate"><span className="text-muted">Factuur</span> {r.inv.number || 'Concept'} · {r.customer?.companyName}</span>
                      <span className="tabular text-[13px] font-medium text-ink">{formatEUR(r.total)}</span>
                      <InvoiceStatusBadge status={r.status} className="hidden sm:inline-flex" />
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {results && results.quotes.length > 0 && (
                <Command.Group heading="Offertes" className={groupCls}>
                  {results.quotes.map((x) => (
                    <Command.Item key={x.id} value={`q-${x.id}`} className={itemCls} onSelect={() => go(`/offertes/${x.id}`)}>
                      {icon(<FilePenLine />)}
                      <span className="flex-1 truncate">Offerte {x.number} · {customerMap.get(x.customerId)?.companyName}</span>
                      <span className="tabular text-[13px] font-medium text-ink">{formatEUR(documentTotals(x.lines).total)}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {results && results.expenses.length > 0 && (
                <Command.Group heading="Bonnetjes & inkoop" className={groupCls}>
                  {results.expenses.map((e) => (
                    <Command.Item key={e.id} value={`e-${e.id}`} className={itemCls} onSelect={() => go(e.kind === 'receipt' ? `/bonnetjes?open=${e.id}` : `/inkoopfacturen?open=${e.id}`)}>
                      {icon(<Receipt />)}
                      <span className="flex-1 truncate">{e.supplierName} {e.kind === 'receipt' ? 'bon' : 'factuur'} <span className="text-faint">· {formatDate(e.date)}</span></span>
                      <span className="tabular text-[13px] font-medium text-ink">{formatEUR(e.total)}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {results && results.transactions.length > 0 && (
                <Command.Group heading="Betalingen" className={groupCls}>
                  {results.transactions.map((t) => (
                    <Command.Item key={t.id} value={`t-${t.id}`} className={itemCls} onSelect={() => go(`/bank?tx=${t.id}`)}>
                      {icon(<ArrowLeftRight />)}
                      <span className="flex-1 truncate">Betaling {t.counterparty} <span className="text-faint">· {formatDate(t.date)}</span></span>
                      <span className={`tabular text-[13px] font-medium ${t.amount > 0 ? 'text-success-600' : 'text-ink'}`}>{formatEUR(t.amount, { sign: true })}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {results && results.suppliers.length > 0 && (
                <Command.Group heading="Leveranciers" className={groupCls}>
                  {results.suppliers.map((s) => (
                    <Command.Item key={s.id} value={`s-${s.id}`} className={itemCls} onSelect={() => go('/leveranciers')}>
                      {icon(<Truck />)}
                      <span className="flex-1 truncate">{s.name}</span>
                      <span className="text-[12px] text-faint">{s.defaultCategory}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
            </Command.List>
            <div className="hidden items-center gap-4 border-t border-line bg-subtle px-5 py-2.5 text-[12px] text-muted sm:flex">
              <span className="flex items-center gap-1.5"><Kbd>↑</Kbd><Kbd>↓</Kbd> navigeren</span>
              <span className="flex items-center gap-1.5"><Kbd><CornerDownLeft className="size-3" /></Kbd> openen</span>
              <span className="ml-auto">Tip: zoek ook op bedrag, bijvoorbeeld “52,89”</span>
            </div>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
