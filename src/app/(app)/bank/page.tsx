'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowDownRight, ArrowUpRight, RefreshCw, Sparkles, Check, FileText, Receipt, Tag, EyeOff, Undo2, Camera, ArrowLeftRight, PartyPopper, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { useBankAccounts, useCategories, useCustomerMap, useExpenses, useInvoiceRows, useStore, useTransactions } from '@/lib/store';
import { useUI } from '@/lib/store/ui';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState, PageHeader, SearchField, Segmented, Amount } from '@/components/ui/misc';
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { scoreInvoiceMatch } from '@/lib/domain/matching';
import { formatEUR } from '@/lib/domain/money';
import { formatDateLong, formatDateShort, relativeTime } from '@/lib/domain/dates';
import type { BankTransaction } from '@/lib/types';
import { normalize, cn, pluralize } from '@/lib/utils';

export default function BankPage() {
  const transactions = useTransactions();
  const accounts = useBankAccounts();
  const syncBank = useStore((s) => s.syncBank);
  const params = useSearchParams();
  const highlight = params.get('tx');
  const [account, setAccount] = useState('all');
  const [tab, setTab] = useState<'todo' | 'all' | 'done'>(highlight ? 'all' : 'todo');
  const [q, setQ] = useState('');
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!highlight) return;
    const t = setTimeout(() => document.getElementById(`tx-${highlight}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
    return () => clearTimeout(t);
  }, [highlight]);

  const scoped = transactions.filter((t) => account === 'all' || t.accountId === account);
  const todo = scoped.filter((t) => t.status === 'todo' || t.status === 'suggested');
  const suggestions = todo.filter((t) => t.status === 'suggested');
  const list = useMemo(() => scoped
    .filter((t) => (tab === 'todo' ? t.status === 'todo' : tab === 'done' ? ['matched', 'categorized', 'ignored'].includes(t.status) : true))
    .filter((t) => !q || normalize(`${t.counterparty} ${t.description}`).includes(normalize(q)) || formatEUR(Math.abs(t.amount)).includes(q))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)), [scoped, tab, q]);

  const groups = useMemo(() => {
    const m = new Map<string, BankTransaction[]>();
    for (const t of list) m.set(t.date, [...(m.get(t.date) ?? []), t]);
    return [...m.entries()];
  }, [list]);

  const lastSync = accounts.map((a) => a.lastSyncAt).sort().at(-1);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Transacties"
        description={lastSync ? `Automatisch bijgewerkt · laatst ${relativeTime(lastSync)}` : 'Koppel je bank om transacties automatisch binnen te halen.'}
        actions={
          <Button variant="outline" loading={syncing} onClick={async () => {
            setSyncing(true);
            await new Promise((r) => setTimeout(r, 1100));
            const n = syncBank(account === 'all' ? undefined : account);
            setSyncing(false);
            toast.success(n ? `${pluralize(n, 'nieuwe transactie', 'nieuwe transacties')} opgehaald` : 'Alles is al up-to-date', { description: n ? 'We hebben direct gekeken of er betalingen voor je facturen bij zitten.' : undefined });
          }}><RefreshCw /> Ophalen</Button>
        }
      />

      {accounts.length > 1 && (
        <div className="mb-5 flex gap-3 overflow-x-auto pb-1 scrollbar-none">
          {[{ id: 'all', name: 'Alle rekeningen', balance: accounts.reduce((s, a) => s + a.balance, 0), iban: `${accounts.length} rekeningen`, color: '#171717' }, ...accounts].map((a) => (
            <button key={a.id} onClick={() => setAccount(a.id)} className={cn('min-w-[200px] rounded-[24px] border bg-surface p-5 text-left shadow-card transition', account === a.id ? 'border-ink ring-1 ring-ink' : 'border-line hover:bg-subtle')}>
              <div className="flex items-center gap-2 text-[12.5px] text-muted"><span className="size-2 rounded-full" style={{ background: a.color }} />{a.name}</div>
              <div className="tabular mt-1 font-display text-[19px] font-semibold">{formatEUR(a.balance)}</div>
              <div className="truncate text-[11.5px] text-faint">{a.iban}</div>
            </button>
          ))}
        </div>
      )}

      <AnimatePresence>
        {suggestions.length > 0 && (
          <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="size-4 text-ink" />
              <h2 className="font-display text-[16px] font-semibold">Brenqo heeft {pluralize(suggestions.length, 'match', 'matches')} gevonden</h2>
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <AnimatePresence>
                {suggestions.map((t) => <motion.div key={t.id} layout exit={{ opacity: 0, scale: 0.97 }}><SuggestionCard tx={t} /></motion.div>)}
              </AnimatePresence>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
          <Segmented value={tab} onChange={setTab} options={[
            { value: 'todo', label: 'Nog verwerken', count: todo.length - suggestions.length },
            { value: 'all', label: 'Alles' },
            { value: 'done', label: 'Verwerkt' },
          ]} />
          <SearchField value={q} onChange={setQ} placeholder="Zoek naam, omschrijving of bedrag" className="sm:w-[300px]" />
        </div>
        {groups.length === 0 ? (
          tab === 'todo'
            ? <EmptyState icon={<PartyPopper />} title="Alles is verwerkt 🎉" description={suggestions.length ? 'Alleen de voorstellen hierboven nog even bevestigen.' : 'Iedere betaling is gekoppeld aan een factuur, bon of categorie.'} compact />
            : <EmptyState icon={<ArrowLeftRight />} title="Geen transacties" compact />
        ) : (
          <div>
            {groups.map(([date, txs]) => (
              <div key={date}>
                <div className="sticky top-16 z-10 border-b border-line bg-subtle/95 px-5 py-2 text-[12px] font-semibold text-muted backdrop-blur">{formatDateLong(date)}</div>
                <ul>{txs.map((t) => <TxRow key={t.id} tx={t} highlight={t.id === highlight} />)}</ul>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function SuggestionCard({ tx }: { tx: BankTransaction }) {
  const rows = useInvoiceRows();
  const expenses = useExpenses();
  const customers = useCustomerMap();
  const confirm = useStore((s) => s.confirmTransaction);
  const unlink = useStore((s) => s.unlinkTransaction);
  const inv = rows.find((r) => r.inv.id === tx.invoiceId);
  const exp = expenses.find((e) => e.id === tx.expenseId);
  const reasons = inv ? scoreInvoiceMatch(tx, inv.inv, customers.get(inv.inv.customerId)).reasons : exp ? ['Bedrag komt exact overeen', `Afzender lijkt op ${exp.supplierName}`] : [];

  return (
    <Card className="relative overflow-hidden">
            <div className="relative p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[12.5px] text-muted">{formatDateShort(tx.date)} · {tx.counterparty}</div>
            <div className="mt-1 font-display text-[17px] font-semibold leading-snug">
              {inv ? <>Factuur {inv.inv.number} lijkt betaald.</> : exp ? <>Dit is waarschijnlijk de {exp.kind === 'receipt' ? 'bon' : 'factuur'} van {exp.supplierName}.</> : 'Mogelijke match'}
            </div>
          </div>
          <Amount value={tx.amount} sign colored className="font-display text-[19px] font-semibold" />
        </div>
        <div className="mt-3 flex items-center gap-3 rounded-[18px] bg-canvas p-3">
          <div className="grid size-9 place-items-center rounded-full bg-surface text-ink">{inv ? <FileText className="size-4" /> : <Receipt className="size-4" />}</div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13.5px] font-medium">{inv ? `${inv.inv.number} · ${inv.customer?.companyName}` : exp ? `${exp.supplierName} · ${exp.category}` : ''}</div>
            <div className="text-[12px] text-muted">{inv ? `Nog open ${formatEUR(inv.due)}` : exp ? formatEUR(exp.total) : ''}</div>
          </div>
          {tx.confidence !== undefined && <Badge tone={tx.confidence >= 80 ? 'success' : 'brand'}>{tx.confidence}% zeker</Badge>}
        </div>
        {reasons.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
            {reasons.map((r) => <li key={r} className="flex items-center gap-1"><Check className="size-3 text-ink" />{r}</li>)}
          </ul>
        )}
        <div className="mt-4 flex gap-2">
          <Button size="sm" className="flex-1" onClick={() => {
            confirm(tx.id);
            toast.success(inv ? `Betaling gekoppeld aan factuur ${inv.inv.number}` : 'Betaling gekoppeld aan bon', { description: inv ? (inv.due - tx.amount <= 0.004 ? 'De factuur staat op betaald en herinneringen zijn gestopt.' : 'Deelbetaling geregistreerd.') : undefined });
          }}><Check /> Bevestigen</Button>
          <Button size="sm" variant="outline" onClick={() => { unlink(tx.id); toast('Voorstel genegeerd'); }}>Niet juist</Button>
        </div>
      </div>
    </Card>
  );
}

function TxRow({ tx, highlight }: { tx: BankTransaction; highlight: boolean }) {
  const rows = useInvoiceRows();
  const expenses = useExpenses();
  const categories = useCategories();
  const openScan = useUI((s) => s.openScan);
  const s = useStore.getState();
  const inv = rows.find((r) => r.inv.id === tx.invoiceId);
  const exp = expenses.find((e) => e.id === tx.expenseId);
  const incoming = tx.amount > 0;
  const openInvoices = rows.filter((r) => r.due > 0 && r.status !== 'draft').sort((a, b) => Math.abs(a.due - tx.amount) - Math.abs(b.due - tx.amount)).slice(0, 8);
  const candidates = expenses.filter((e) => !e.transactionId).sort((a, b) => Math.abs(a.total + tx.amount) - Math.abs(b.total + tx.amount)).slice(0, 6);

  const status =
    tx.status === 'matched' && inv ? <Badge tone="success" dot>Factuur {inv.inv.number}</Badge>
      : tx.status === 'matched' && exp ? <Badge tone="success" dot>{exp.kind === 'receipt' ? 'Bon' : 'Inkoopfactuur'} {exp.supplierName}</Badge>
        : tx.status === 'categorized' ? <Badge tone="neutral">{tx.category}</Badge>
          : tx.status === 'ignored' ? <Badge tone="muted">Genegeerd</Badge>
            : tx.status === 'suggested' ? <Badge tone="brand" dot>Voorstel klaar</Badge>
              : <Badge tone="warning" dot>Nog verwerken</Badge>;

  return (
    <li id={`tx-${tx.id}`} className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line/70 px-5 py-3.5 transition last:border-0 sm:flex-nowrap', highlight && 'bg-brand-50/60')}>
      <div className={cn('grid size-9 shrink-0 place-items-center rounded-full', incoming ? 'bg-ink-2 text-[#fafafa]' : 'bg-canvas text-ink')}>
        {incoming ? <ArrowDownRight className="size-4" /> : <ArrowUpRight className="size-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14.5px] font-medium">{tx.counterparty}</div>
        <div className="truncate text-[12.5px] text-muted">{tx.description}</div>
      </div>
      <div className="order-last w-full pl-[52px] sm:order-none sm:w-auto sm:pl-0">{status}</div>
      <Amount value={tx.amount} sign colored className="w-[110px] text-right text-[14.5px] font-semibold" />
      <Menu>
        <MenuTrigger asChild>
          <Button size="sm" variant={tx.status === 'todo' ? 'soft' : 'ghost'} className="shrink-0">{tx.status === 'todo' ? 'Verwerken' : <Link2 />}</Button>
        </MenuTrigger>
        <MenuContent className="w-[280px]">
          {incoming ? (
            <>
              <MenuLabel>Koppel aan factuur</MenuLabel>
              {openInvoices.length === 0 && <div className="px-2.5 py-2 text-[13px] text-muted">Geen openstaande facturen</div>}
              {openInvoices.map((r) => (
                <MenuItem key={r.inv.id} icon={<FileText />} hint={formatEUR(r.due)} onSelect={() => { s.linkTransactionToInvoice(tx.id, r.inv.id); toast.success(`Betaling gekoppeld aan factuur ${r.inv.number}`); }}>
                  {r.inv.number} · {r.customer?.companyName}
                </MenuItem>
              ))}
            </>
          ) : (
            <>
              <MenuLabel>Koppel aan bon of factuur</MenuLabel>
              {candidates.map((e) => (
                <MenuItem key={e.id} icon={<Receipt />} hint={formatEUR(e.total)} onSelect={() => { s.linkTransactionToExpense(tx.id, e.id); toast.success(`Gekoppeld aan ${e.supplierName}`); }}>{e.supplierName}</MenuItem>
              ))}
              <MenuItem icon={<Camera />} onSelect={() => openScan('receipt', true)}>Bon toevoegen</MenuItem>
            </>
          )}
          <MenuSeparator />
          <MenuLabel>Of boek als</MenuLabel>
          <div className="max-h-[180px] overflow-y-auto">
            {[...categories.map((c) => c.name), 'Privé', 'Belastingen', 'Eigen overboeking'].map((c) => (
              <MenuItem key={c} icon={<Tag />} onSelect={() => { s.categorizeTransaction(tx.id, c); toast.success(`Geboekt als ${c.toLowerCase()}`); }}>{c}</MenuItem>
            ))}
          </div>
          <MenuSeparator />
          {tx.status !== 'todo' ? (
            <MenuItem icon={<Undo2 />} onSelect={() => { s.unlinkTransaction(tx.id); toast('Koppeling ongedaan gemaakt'); }}>Koppeling ongedaan maken</MenuItem>
          ) : (
            <MenuItem icon={<EyeOff />} onSelect={() => { s.ignoreTransaction(tx.id); toast('Transactie genegeerd'); }}>Negeren</MenuItem>
          )}
        </MenuContent>
      </Menu>
    </li>
  );
}
