'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { FileText, Plus, Send, Download, BellRing, CircleCheck, Trash, X, Layers, Repeat, SearchX } from 'lucide-react';
import { toast } from 'sonner';
import { useInvoiceRows, useOrg, useStore, type InvoiceRow } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, Checkbox, EmptyState, PageHeader, SearchField, Segmented } from '@/components/ui/misc';
import { InvoiceStatusBadge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/dialog';
import { InvoiceRowMenu, useInvoiceCommands } from '@/components/invoice-actions';
import { formatEUR, parseAmount } from '@/lib/domain/money';
import { daysBetween, formatDate, todayISO } from '@/lib/domain/dates';
import { normalize, cn, pluralize } from '@/lib/utils';
import { invoiceEmail } from '@/lib/emails';
import { deliverEmail, publicUrl } from '@/lib/services/email';
import { downloadPdf, invoiceToDoc } from '@/lib/pdf/download';

type Filter = 'all' | 'draft' | 'open' | 'overdue' | 'paid';
const OPEN = ['sent', 'viewed', 'open', 'partial'];

export default function InvoicesPage() {
  const params = useSearchParams();
  const router = useRouter();
  const rows = useInvoiceRows();
  const org = useOrg();
  const [filter, setFilter] = useState<Filter>((params.get('filter') as Filter) || 'all');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmSend, setConfirmSend] = useState(false);
  const [limit, setLimit] = useState(40);
  const cmd = useInvoiceCommands();
  const today = todayISO();

  const counts = useMemo(() => ({
    all: rows.length,
    draft: rows.filter((r) => r.status === 'draft').length,
    open: rows.filter((r) => OPEN.includes(r.status)).length,
    overdue: rows.filter((r) => r.status === 'overdue').length,
    paid: rows.filter((r) => r.status === 'paid').length,
  }), [rows]);

  const totals = useMemo(() => ({
    open: rows.filter((r) => OPEN.includes(r.status)).reduce((s, r) => s + r.due, 0),
    overdue: rows.filter((r) => r.status === 'overdue').reduce((s, r) => s + r.due, 0),
    paidYear: rows.filter((r) => r.inv.kind === 'invoice' && r.inv.paidAt?.startsWith(today.slice(0, 4))).reduce((s, r) => s + r.total, 0),
  }), [rows, today]);

  const visible = useMemo(() => {
    const nq = normalize(q);
    const amount = /\d/.test(q) ? parseAmount(q) : 0;
    return rows.filter((r) => {
      if (filter === 'draft' && r.status !== 'draft') return false;
      if (filter === 'open' && !OPEN.includes(r.status)) return false;
      if (filter === 'overdue' && r.status !== 'overdue') return false;
      if (filter === 'paid' && r.status !== 'paid') return false;
      if (!nq) return true;
      return (
        normalize(r.inv.number).includes(nq) ||
        normalize(r.customer?.companyName ?? '').includes(nq) ||
        normalize(r.inv.reference).includes(nq) ||
        (amount > 0 && (Math.abs(r.total - amount) < 0.01 || formatEUR(r.total).includes(q.trim())))
      );
    });
  }, [rows, filter, q]);

  const selectedRows = visible.filter((r) => selected.has(r.inv.id));
  const allChecked = visible.length > 0 && selectedRows.length === visible.length;
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function bulkSend() {
    const s = useStore.getState();
    const sendable = selectedRows.filter((r) => r.status !== 'paid' && r.status !== 'credited');
    for (const r of sendable) {
      const mail = invoiceEmail(org, r.customer, r.inv);
      if (!mail.to) continue;
      await deliverEmail({ ...mail, fromName: org.name, action: { label: 'Bekijk en betaal', url: publicUrl(`/f/${r.inv.publicToken}`) } });
      s.sendInvoice(r.inv.id, mail);
    }
    setConfirmSend(false);
    setSelected(new Set());
    toast.success(`${pluralize(sendable.length, 'factuur', 'facturen')} verstuurd`, { description: 'Iedere klant krijgt zijn eigen factuur met betaallink.' });
  }

  async function bulkDownload() {
    const t = toast.loading(`${selectedRows.length} PDF's worden gemaakt…`);
    for (const r of selectedRows) await downloadPdf(org, r.customer, invoiceToDoc(r.inv));
    toast.success('Download klaar', { id: t });
  }

  function bulkRemind() {
    const s = useStore.getState();
    const overdue = selectedRows.filter((r) => r.status === 'overdue');
    overdue.forEach((r) => s.sendReminder(r.inv.id));
    toast.success(overdue.length ? `${pluralize(overdue.length, 'herinnering', 'herinneringen')} verstuurd` : 'Geen verlopen facturen geselecteerd');
    setSelected(new Set());
  }

  function bulkPaid() {
    const s = useStore.getState();
    const open = selectedRows.filter((r) => r.due > 0);
    open.forEach((r) => s.registerPayment(r.inv.id, { date: today, amount: r.due, method: 'bank', source: 'manual' }));
    toast.success(`${pluralize(open.length, 'factuur staat', 'facturen staan')} op betaald`);
    setSelected(new Set());
  }

  function bulkDelete() {
    const n = useStore.getState().deleteInvoices(selectedRows.map((r) => r.inv.id));
    toast.success(n ? `${pluralize(n, 'concept', 'concepten')} verwijderd` : 'Alleen concepten kunnen worden verwijderd');
    setSelected(new Set());
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Facturen"
        description="Alles wat je hebt gefactureerd, en wat er nog binnen moet komen."
        actions={
          <>
            <Button variant="outline" asChild className="hidden sm:inline-flex"><Link href="/periodiek"><Repeat /> Periodiek</Link></Button>
            <Button variant="outline" asChild><Link href="/facturen/bulk"><Layers /> {org.kind === 'association' ? 'Contributie / bulk' : 'Meerdere tegelijk'}</Link></Button>
            <Button asChild><Link href="/facturen/nieuw"><Plus strokeWidth={2.5} /> Nieuwe factuur</Link></Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-3 gap-3">
        <SummaryTile label="Nog te ontvangen" value={totals.open} onClick={() => setFilter('open')} />
        <SummaryTile label="Verlopen" value={totals.overdue} tone="danger" onClick={() => setFilter('overdue')} />
        <SummaryTile label={`Betaald in ${today.slice(0, 4)}`} value={totals.paidYear} tone="success" onClick={() => setFilter('paid')} />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
          <Segmented
            value={filter}
            onChange={(v) => { setFilter(v); setSelected(new Set()); router.replace(v === 'all' ? '/facturen' : `/facturen?filter=${v}`, { scroll: false }); }}
            options={[
              { value: 'all', label: 'Alle', count: counts.all },
              { value: 'draft', label: 'Concept', count: counts.draft },
              { value: 'open', label: 'Openstaand', count: counts.open },
              { value: 'overdue', label: 'Verlopen', count: counts.overdue },
              { value: 'paid', label: 'Betaald', count: counts.paid },
            ]}
          />
          <SearchField value={q} onChange={setQ} placeholder="Zoek op klant, nummer of bedrag" className="sm:w-[300px]" />
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={<FileText />}
            title="Je hebt nog geen facturen"
            description="Maak je eerste factuur en verstuur hem binnen een minuut."
            action={<Button asChild size="lg"><Link href="/facturen/nieuw"><Plus /> Maak eerste factuur</Link></Button>}
          />
        ) : visible.length === 0 ? (
          <EmptyState compact icon={<SearchX />} title={q ? 'Niets gevonden' : filter === 'overdue' ? 'Geen verlopen facturen 🎉' : 'Hier staat niets'} description={q ? `Geen facturen die passen bij “${q}”.` : 'Fijn, zo hoort het.'} />
        ) : (
          <>
            <div className="hidden grid-cols-[28px_minmax(110px,0.9fr)_minmax(180px,2fr)_110px_120px_130px_130px_36px] items-center gap-4 border-b border-line bg-subtle/60 px-5 py-2.5 text-[12px] font-medium text-muted md:grid">
              <Checkbox checked={allChecked ? true : selectedRows.length ? 'indeterminate' : false} onCheckedChange={(v) => setSelected(v ? new Set(visible.map((r) => r.inv.id)) : new Set())} aria-label="Alles selecteren" />
              <span>Nummer</span><span>Klant</span><span>Datum</span><span>Vervaldatum</span><span className="text-right">Bedrag</span><span>Status</span><span />
            </div>
            <ul>
              {visible.slice(0, limit).map((r) => (
                <Row key={r.inv.id} row={r} today={today} checked={selected.has(r.inv.id)} onCheck={() => toggle(r.inv.id)} onOpen={() => cmd.view(r.inv.id)} />
              ))}
            </ul>
            {visible.length > limit && (
              <div className="border-t border-line p-3 text-center">
                <Button variant="ghost" size="sm" onClick={() => setLimit((l) => l + 40)}>Toon meer ({visible.length - limit})</Button>
              </div>
            )}
          </>
        )}
      </Card>

      <AnimatePresence>
        {selectedRows.length > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="fixed inset-x-3 bottom-[calc(80px+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-[760px] items-center gap-1 overflow-x-auto rounded-[18px] bg-ink p-2 text-white shadow-pop scrollbar-none lg:bottom-6"
          >
            <span className="shrink-0 px-3 text-[13.5px] font-medium">{selectedRows.length} geselecteerd</span>
            <div className="mx-1 h-6 w-px shrink-0 bg-white/15" />
            {[
              [<Send key="s" />, 'Verstuur', () => setConfirmSend(true)],
              [<Download key="d" />, 'Download', bulkDownload],
              [<BellRing key="b" />, 'Herinnering', bulkRemind],
              [<CircleCheck key="c" />, 'Markeer betaald', bulkPaid],
              [<Trash key="t" />, 'Verwijder concept', bulkDelete],
            ].map(([icon, label, fn]) => (
              <button key={label as string} onClick={fn as () => void} className="flex h-9 shrink-0 items-center gap-2 rounded-[11px] px-3 text-[13px] font-medium text-white/85 transition hover:bg-white/10 hover:text-white [&_svg]:size-4">
                {icon as React.ReactNode}{label as string}
              </button>
            ))}
            <button onClick={() => setSelected(new Set())} className="ml-auto grid size-9 shrink-0 place-items-center rounded-[11px] text-white/60 hover:bg-white/10 hover:text-white" aria-label="Selectie wissen"><X className="size-4" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      <Modal
        open={confirmSend}
        onOpenChange={setConfirmSend}
        title={`${pluralize(selectedRows.length, 'factuur', 'facturen')} versturen?`}
        description="Iedere klant krijgt de standaard e-mail met de PDF en een betaallink. Concepten krijgen eerst een factuurnummer."
        icon={<Send />}
        size="sm"
        footer={<><Button variant="outline" onClick={() => setConfirmSend(false)}>Annuleren</Button><Button onClick={bulkSend}><Send /> Verstuur alles</Button></>}
      >
        <ul className="space-y-1.5">
          {selectedRows.slice(0, 8).map((r) => (
            <li key={r.inv.id} className="flex justify-between text-[13.5px]"><span className="truncate">{r.customer?.companyName}</span><span className="tabular text-muted">{formatEUR(r.total)}</span></li>
          ))}
          {selectedRows.length > 8 && <li className="text-[13px] text-muted">en nog {selectedRows.length - 8}…</li>}
        </ul>
      </Modal>
    </div>
  );
}

function SummaryTile({ label, value, tone, onClick }: { label: string; value: number; tone?: 'danger' | 'success'; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-[16px] border border-line bg-surface p-3.5 text-left shadow-card transition hover:shadow-raised sm:p-4">
      <div className="flex items-center gap-1.5 text-[12px] font-medium text-muted sm:text-[13px]">
        {tone && <span className={cn('size-1.5 rounded-full', tone === 'danger' ? 'bg-danger-500' : 'bg-success-500')} />}
        {label}
      </div>
      <div className="tabular mt-1 font-display text-[17px] font-bold tracking-[-0.02em] sm:text-[22px]">{formatEUR(value, { round: true })}</div>
    </button>
  );
}

function Row({ row, today, checked, onCheck, onOpen }: { row: InvoiceRow; today: string; checked: boolean; onCheck: () => void; onOpen: () => void }) {
  const { inv, customer, status, total } = row;
  const days = daysBetween(today, inv.dueDate);
  const dueText = status === 'overdue' ? `${-days} dagen te laat` : status === 'paid' || status === 'draft' || status === 'credited' ? formatDate(inv.dueDate) : days === 0 ? 'vandaag' : `over ${days} dagen`;
  return (
    <li
      onClick={onOpen}
      className={cn('group cursor-pointer border-b border-line/70 transition last:border-0 hover:bg-subtle/70', checked && 'bg-brand-50/50 hover:bg-brand-50/70')}
    >
      {/* Desktop */}
      <div className="hidden grid-cols-[28px_minmax(110px,0.9fr)_minmax(180px,2fr)_110px_120px_130px_130px_36px] items-center gap-4 px-5 py-3.5 md:grid">
        <Checkbox checked={checked} onCheckedChange={onCheck} aria-label={`Selecteer ${inv.number}`} />
        <span className="font-medium tabular text-ink">{inv.number || <span className="text-muted">Concept</span>}{inv.kind === 'credit' && <span className="ml-1.5 text-[11px] text-muted">credit</span>}</span>
        <span className="flex min-w-0 items-center gap-3">
          <Avatar name={customer?.companyName ?? '?'} size={28} />
          <span className="truncate text-[14px] text-ink">{customer?.companyName}</span>
        </span>
        <span className="text-[13.5px] text-muted">{formatDate(inv.issueDate)}</span>
        <span className={cn('text-[13.5px]', status === 'overdue' ? 'font-medium text-danger-600' : 'text-muted')}>{dueText}</span>
        <span className="tabular text-right text-[14px] font-semibold">{formatEUR(total)}</span>
        <span><InvoiceStatusBadge status={status} /></span>
        <InvoiceRowMenu row={row} className="opacity-60 group-hover:opacity-100" />
      </div>
      {/* Mobile */}
      <div className="flex items-center gap-3 px-4 py-3.5 md:hidden">
        <Avatar name={customer?.companyName ?? '?'} size={38} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14.5px] font-medium">{customer?.companyName}</div>
          <div className={cn('text-[12.5px]', status === 'overdue' ? 'text-danger-600' : 'text-muted')}>{inv.number || 'Concept'} · {dueText}</div>
        </div>
        <div className="text-right">
          <div className="tabular text-[14.5px] font-semibold">{formatEUR(total)}</div>
          <InvoiceStatusBadge status={status} className="mt-1 h-5 px-2 text-[11px]" />
        </div>
      </div>
    </li>
  );
}
