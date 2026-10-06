'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { Camera, Upload, Receipt, FileInput, Check, Pencil, Trash, Inbox, Copy, Mail, Brain, Link2, Sparkles, SearchX } from 'lucide-react';
import { toast } from 'sonner';
import { useCategories, useExpenses, useOrg, useStore, useSuppliers, useTransactions } from '@/lib/store';
import { useUI } from '@/lib/store/ui';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState, PageHeader, SearchField } from '@/components/ui/misc';
import { Drawer } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/input';
import { CategoryChip, CategoryIcon } from '@/components/category-icon';
import { DocThumb } from '@/components/flows/scan-flow';
import { formatEUR, parseAmount, round2 } from '@/lib/domain/money';
import { formatDate, formatDateLong, todayISO, addDays } from '@/lib/domain/dates';
import { findSupplier } from '@/lib/domain/categories';
import type { Expense, VatRate } from '@/lib/types';
import { normalize, cn, pluralize } from '@/lib/utils';
import { documentUrl } from '@/lib/backend/sync';

const MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

export function ExpensesView({ kind }: { kind: 'receipt' | 'invoice' }) {
  const all = useExpenses();
  const org = useOrg();
  const suppliers = useSuppliers();
  const categories = useCategories();
  const openScan = useUI((s) => s.openScan);
  const saveExpense = useStore((s) => s.saveExpense);
  const params = useSearchParams();
  const [q, setQ] = useState('');
  const [period, setPeriod] = useState('all');
  const [category, setCategory] = useState('all');
  const [supplier, setSupplier] = useState('all');
  const [minAmount, setMinAmount] = useState('');
  const [openId, setOpenId] = useState<string | null>(params.get('open'));
  const isReceipt = kind === 'receipt';

  useEffect(() => { setOpenId(params.get('open')); }, [params]);

  const items = useMemo(() => all.filter((e) => e.kind === kind).sort((a, b) => b.date.localeCompare(a.date)), [all, kind]);
  const review = items.filter((e) => e.status === 'review');
  const years = [...new Set(items.map((e) => e.date.slice(0, 4)))];
  const periods = useMemo(() => {
    const months = [...new Set(items.map((e) => e.date.slice(0, 7)))].slice(0, 12);
    return months;
  }, [items]);

  const visible = items.filter((e) => {
    if (e.status === 'review') return false;
    if (period !== 'all' && !e.date.startsWith(period)) return false;
    if (category !== 'all' && e.category !== category) return false;
    if (supplier !== 'all' && e.supplierName !== supplier) return false;
    if (minAmount && e.total < parseAmount(minAmount)) return false;
    if (q) {
      const nq = normalize(q);
      const amount = /\d/.test(q) ? parseAmount(q) : 0;
      if (!(normalize(`${e.supplierName} ${e.description} ${e.category} ${e.invoiceNumber}`).includes(nq) || (amount && Math.abs(e.total - amount) < 0.01))) return false;
    }
    return true;
  });
  const visibleTotal = visible.reduce((s, e) => s + e.total, 0);
  const visibleVat = visible.reduce((s, e) => s + e.vatAmount, 0);
  const supplierNames = [...new Set(items.map((e) => e.supplierName))].sort();

  function simulateInbox() {
    const options = [
      { supplierName: 'Cloud86', total: 24.95, description: 'Resellerhosting', invoiceNumber: `C86-${Date.now().toString().slice(-6)}`, iban: 'NL86INGB0002445588' },
      { supplierName: 'Canva', total: 11.99, description: 'Canva Pro', invoiceNumber: `CNV-${Date.now().toString().slice(-6)}`, iban: '' },
      { supplierName: 'TransIP', total: 14.52, description: 'Domeinnamen', invoiceNumber: `TIP-${Date.now().toString().slice(-6)}`, iban: 'NL41INGB0007773434' },
    ];
    const pick = options[Math.floor(Math.random() * options.length)];
    const known = findSupplier(pick.supplierName, suppliers);
    const vat = round2(pick.total - pick.total / 1.21);
    const today = todayISO();
    saveExpense({
      kind: 'invoice', ...pick, date: today, dueDate: addDays(today, 14), subtotal: round2(pick.total - vat), vatAmount: vat, vatRate: 21,
      category: known?.defaultCategory ?? 'Hosting', status: 'review', paid: false, source: 'email',
      document: { fileName: `${pick.supplierName}-factuur-${pick.invoiceNumber}.pdf`, mimeType: 'application/pdf' },
    });
    useStore.getState().pushNotification({ kind: 'expense', title: `Nieuwe inkoopfactuur van ${pick.supplierName} ontvangen.`, body: 'Automatisch uitgelezen uit je inbox.', href: '/inkoopfacturen' });
    toast.success(`Inkoopfactuur van ${pick.supplierName} ontvangen`, { description: 'De PDF is uitgelezen en staat klaar om te controleren.' });
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={isReceipt ? 'Bonnetjes' : 'Inkoopfacturen'}
        description={isReceipt ? 'Maak een foto, wij doen de rest. Alles wordt veilig bewaard.' : 'Facturen van leveranciers. Upload, forward of laat ze naar je inbox-adres sturen.'}
        actions={isReceipt ? (
          <>
            <Button variant="outline" onClick={() => openScan('receipt')}><Upload /> Upload</Button>
            <Button onClick={() => openScan('receipt', true)}><Camera /> Bon toevoegen</Button>
          </>
        ) : <Button onClick={() => openScan('invoice')}><Upload /> Inkoopfactuur uploaden</Button>}
      />

      {!isReceipt && (
        <Card className="mb-5 flex flex-col gap-4 overflow-hidden p-5 sm:flex-row sm:items-center">
          <div className="grid size-12 shrink-0 place-items-center rounded-full bg-ink text-[#fafafa]"><Inbox className="size-5" /></div>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold">Jouw inbox-adres voor inkoopfacturen</div>
            <div className="mt-0.5 text-[13.5px] text-muted">Stuur of forward facturen naar dit adres. Wij pakken de PDF, lezen hem uit en zetten hem hier klaar.</div>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-subtle p-1.5 pl-3 ring-1 ring-line">
            <Mail className="size-4 shrink-0 text-muted" />
            <span className="truncate text-[13.5px] font-medium">{org.inboxAddress}</span>
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard?.writeText(org.inboxAddress); toast.success('Adres gekopieerd'); }}><Copy /> Kopieer</Button>
          </div>
          <Button size="sm" variant="ghost" onClick={simulateInbox} title="Demo: doe alsof er een factuur binnenkomt">Test ontvangst</Button>
        </Card>
      )}

      <AnimatePresence>
        {review.length > 0 && (
          <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <h2 className="font-display text-[16px] font-semibold">Even controleren</h2>
              <Badge tone="warning">{review.length}</Badge>
              <span className="text-[13px] text-muted">Al uitgelezen, klopt het?</span>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              <AnimatePresence>
                {review.map((e) => (
                  <motion.div key={e.id} layout exit={{ opacity: 0, scale: 0.96 }}>
                    <ReviewCard expense={e} onEdit={() => setOpenId(e.id)} memory={!!findSupplier(e.supplierName, suppliers)?.timesUsed} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center">
          <SearchField value={q} onChange={setQ} placeholder={isReceipt ? 'Zoek leverancier of bedrag, bijv. 52,89' : 'Zoek leverancier, nummer of bedrag'} className="lg:w-[300px]" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:ml-auto lg:flex">
            <Select value={period} onChange={(e) => setPeriod(e.target.value)} className="lg:w-[150px]">
              <option value="all">Alle periodes</option>
              {years.map((y) => <option key={y} value={y}>Heel {y}</option>)}
              {periods.map((p) => <option key={p} value={p}>{MONTHS[Number(p.slice(5, 7)) - 1]} {p.slice(0, 4)}</option>)}
            </Select>
            <Select value={category} onChange={(e) => setCategory(e.target.value)} className="lg:w-[160px]">
              <option value="all">Alle categorieën</option>
              {categories.map((c) => <option key={c.id}>{c.name}</option>)}
            </Select>
            <Select value={supplier} onChange={(e) => setSupplier(e.target.value)} className="lg:w-[160px]">
              <option value="all">Alle leveranciers</option>
              {supplierNames.map((s) => <option key={s}>{s}</option>)}
            </Select>
            <Input prefix="≥ €" inputMode="decimal" placeholder="Bedrag" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} className="lg:w-[120px]" />
          </div>
        </div>
        {items.length === 0 ? (
          <EmptyState
            icon={isReceipt ? <Receipt /> : <FileInput />}
            title={isReceipt ? 'Nog geen bonnetjes' : 'Nog geen inkoopfacturen'}
            description={isReceipt ? 'Maak een foto van je eerste bon. Binnen een paar seconden staat hij in je administratie.' : 'Upload een PDF of forward hem naar je inbox-adres.'}
            action={<Button size="lg" onClick={() => openScan(kind, isReceipt)}>{isReceipt ? <><Camera /> Bon scannen</> : <><Upload /> Uploaden</>}</Button>}
          />
        ) : visible.length === 0 ? (
          review.length && !q && period === 'all' && category === 'all' ? (
            <EmptyState compact icon={<Sparkles />} title="Alles staat hierboven klaar" description="Controleer de uitgelezen documenten, dan verschijnen ze hier." />
          ) : <EmptyState compact icon={<SearchX />} title="Niets gevonden" description="Probeer een ander filter." />
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-line bg-subtle/60 px-5 py-2.5 text-[12.5px] text-muted">
              <span>{pluralize(visible.length, 'document', 'documenten')}</span>
              <span className="tabular">Totaal <span className="font-semibold text-ink">{formatEUR(visibleTotal)}</span> · btw {formatEUR(visibleVat)}</span>
            </div>
            <ul>
              {visible.map((e) => (
                <li key={e.id}>
                  <button onClick={() => setOpenId(e.id)} className="flex w-full items-center gap-4 border-b border-line/70 px-5 py-3 text-left transition last:border-0 hover:bg-subtle/70">
                    <DocThumb preview={e.document.previewDataUrl} mime={e.document.mimeType} className="h-12 w-10" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14.5px] font-medium">{e.supplierName}</div>
                      <div className="truncate text-[12.5px] text-muted">{formatDate(e.date)}{e.description ? ` · ${e.description}` : ''}</div>
                    </div>
                    <div className="hidden md:block"><CategoryChip name={e.category} /></div>
                    <div className="hidden w-[110px] lg:block">
                      {e.transactionId ? <Badge tone="success" dot>Gekoppeld</Badge> : !isReceipt && !e.paid ? <Badge tone="warning" dot>Nog betalen</Badge> : <Badge tone="neutral" dot>Verwerkt</Badge>}
                    </div>
                    <div className="w-[96px] text-right">
                      <div className="tabular text-[14.5px] font-semibold">{formatEUR(e.total)}</div>
                      {e.vatAmount > 0 && <div className="tabular text-[11.5px] text-muted">{formatEUR(e.vatAmount)} btw</div>}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <ExpenseDrawer id={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

function ReviewCard({ expense: e, onEdit, memory }: { expense: Expense; onEdit: () => void; memory: boolean }) {
  const saveExpense = useStore((s) => s.saveExpense);
  return (
    <Card className="overflow-hidden">
      <div className="flex gap-4 p-4">
        <DocThumb preview={e.document.previewDataUrl} mime={e.document.mimeType} className="h-[72px] w-14" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="truncate text-[15px] font-semibold">{e.supplierName}</div>
            <div className="tabular font-display text-[17px] font-semibold">{formatEUR(e.total)}</div>
          </div>
          <div className="text-[12.5px] text-muted">{formatDateLong(e.date)} · {formatEUR(e.vatAmount)} btw</div>
          <div className="mt-2 flex items-center gap-1.5 text-[12.5px] font-medium text-ink-2"><CategoryIcon name={e.category} className="size-3.5 text-brand-600" />{e.category}</div>
        </div>
      </div>
      {memory && <div className="flex items-center gap-1.5 border-t border-line bg-subtle px-4 py-2 text-[12px] text-ink"><Brain className="size-3.5" /> Herkend op basis van eerdere keuzes</div>}
      <div className="flex gap-2 border-t border-line p-3">
        <Button size="sm" variant="success" className="flex-1" onClick={() => { saveExpense({ ...e, status: 'processed' }); toast.success(`${e.kind === 'receipt' ? 'Bon' : 'Factuur'} van ${e.supplierName} verwerkt`); }}><Check /> Klopt</Button>
        <Button size="sm" variant="outline" className="flex-1" onClick={onEdit}><Pencil /> Aanpassen</Button>
      </div>
    </Card>
  );
}

function ExpenseDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const expense = useStore((s) => s.expenses.find((e) => e.id === id));
  const categories = useCategories();
  const transactions = useTransactions();
  const saveExpense = useStore((s) => s.saveExpense);
  const deleteExpense = useStore((s) => s.deleteExpense);
  const [form, setForm] = useState<Expense | null>(null);
  useEffect(() => { setForm(expense ? { ...expense } : null); }, [expense?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!form || !expense) return null;
  const tx = transactions.find((t) => t.id === expense.transactionId);
  const set = (p: Partial<Expense>) => setForm((f) => (f ? { ...f, ...p } : f));

  return (
    <Drawer
      open={!!id}
      onOpenChange={(o) => !o && onClose()}
      title={expense.supplierName}
      description={`${expense.kind === 'receipt' ? 'Bon' : 'Inkoopfactuur'} · ${formatDateLong(expense.date)}`}
      width={520}
      footer={
        <>
          <Button variant="ghost" className="text-danger-600" onClick={() => { deleteExpense(expense.id); onClose(); toast.success('Verwijderd'); }}><Trash /></Button>
          <Button className="flex-1" onClick={() => { saveExpense({ ...form, status: 'processed' }); onClose(); toast.success('Opgeslagen', { description: `${form.supplierName} wordt voortaan geboekt als ${form.category.toLowerCase()}.` }); }}><Check /> {expense.status === 'review' ? 'Klopt, opslaan' : 'Opslaan'}</Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid place-items-center rounded-2xl bg-subtle p-4 ring-1 ring-line">
          {expense.document.previewDataUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={expense.document.previewDataUrl} alt="" className="max-h-[320px] rounded-xl shadow-raised" />
            : <div className="flex flex-col items-center py-6 text-center"><DocThumb mime={expense.document.mimeType} className="h-24 w-[72px]" /><div className="mt-3 text-[12.5px] text-muted">{expense.document.fileName}</div></div>}
          {expense.document.storagePath && (
            <Button variant="outline" size="sm" className="mt-3" onClick={async () => { const url = await documentUrl(expense.document.storagePath!); if (url) window.open(url, '_blank', 'noopener'); }}>Origineel openen</Button>
          )}
        </div>
        <Field label="Leverancier"><Input value={form.supplierName} onChange={(e) => set({ supplierName: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Datum"><Input type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} /></Field>
          <Field label="Categorie"><Select value={form.category} onChange={(e) => set({ category: e.target.value })}>{categories.map((c) => <option key={c.id}>{c.name}</option>)}</Select></Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Totaal"><Input prefix="€" inputMode="decimal" defaultValue={String(form.total).replace('.', ',')} key={`t${form.id}`} onBlur={(e) => { const total = parseAmount(e.target.value); const vat = round2(total - total / (1 + form.vatRate / 100)); set({ total, vatAmount: vat, subtotal: round2(total - vat) }); }} /></Field>
          <Field label="Btw-tarief"><Select value={form.vatRate} onChange={(e) => { const r = Number(e.target.value) as VatRate; const vat = round2(form.total - form.total / (1 + r / 100)); set({ vatRate: r, vatAmount: vat, subtotal: round2(form.total - vat) }); }}><option value={21}>21%</option><option value={9}>9%</option><option value={0}>0%</option></Select></Field>
          <Field label="Btw"><Input prefix="€" value={String(form.vatAmount).replace('.', ',')} key={`v${form.vatAmount}`} readOnly /></Field>
        </div>
        {expense.kind === 'invoice' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Factuurnummer"><Input value={form.invoiceNumber} onChange={(e) => set({ invoiceNumber: e.target.value })} /></Field>
            <Field label="Vervaldatum"><Input type="date" value={form.dueDate ?? ''} onChange={(e) => set({ dueDate: e.target.value })} /></Field>
          </div>
        )}
        {expense.kind === 'invoice' && <Field label="IBAN leverancier" optional><Input value={form.iban} onChange={(e) => set({ iban: e.target.value })} /></Field>}
        <Field label="Omschrijving" optional><Input value={form.description} onChange={(e) => set({ description: e.target.value })} /></Field>
        <div className={cn('flex items-center gap-3 rounded-[18px] p-4 text-[13px]', tx ? 'bg-canvas text-ink' : 'bg-canvas text-muted')}>
          <Link2 className="size-4 shrink-0" />
          {tx ? <>Gekoppeld aan betaling van {formatEUR(-tx.amount)} op {formatDate(tx.date)}</> : 'Nog niet gekoppeld aan een banktransactie. Dat gebeurt automatisch zodra de betaling binnenkomt.'}
        </div>
      </div>
    </Drawer>
  );
}
