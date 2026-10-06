'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { Download, Eye, CircleCheck, ChevronDown, FileX, Landmark, Copy, CalendarClock, LoaderCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useStore } from '@/lib/store';
import { PublicShell } from '@/components/public-shell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { InvoiceDocument } from '@/components/documents/invoice-document';
import { OrgMark } from '@/components/shell/org-switcher';
import { downloadPdf, invoiceToDoc } from '@/lib/pdf/download';
import { amountDue, invoiceTotal } from '@/lib/domain/calc';
import { invoiceStatus } from '@/lib/domain/status';
import { formatEUR } from '@/lib/domain/money';
import { formatDateLong, todayISO } from '@/lib/domain/dates';
import { startPayment } from '@/lib/services/payments';
import { usePublicInvoice } from '@/lib/public/hooks';
import { backendEnabled } from '@/lib/backend/config';

export default function PublicInvoicePage() {
  return <PublicShell><PublicInvoice /></PublicShell>;
}

function PublicInvoice() {
  const { token } = useParams<{ token: string }>();
  const params = useSearchParams();
  const justPaid = params.get('betaald') === '1';
  const view = usePublicInvoice(token, { waitForPayment: justPaid });
  const markViewed = useStore((s) => s.markInvoiceViewed);
  const router = useRouter();
  const [showDoc, setShowDoc] = useState(false);
  const [paying, setPaying] = useState(false);
  const inv = view.status === 'ready' ? view.invoice : undefined;
  const org = view.status === 'ready' ? view.org : undefined;
  const customer = view.status === 'ready' ? view.customer : undefined;

  useEffect(() => { if (inv && !backendEnabled) markViewed(token); }, [inv?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (view.status === 'loading') {
    return <div className="flex flex-col items-center gap-3 pt-24 text-muted"><LoaderCircle className="size-5 animate-spin" />Factuur wordt geladen…</div>;
  }

  if (!inv || !org) {
    return (
      <div className="pt-16 text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-surface text-muted shadow-raised ring-1 ring-line"><FileX className="size-6" /></div>
        <h1 className="mt-5 font-display text-[22px] font-semibold">Deze factuur kunnen we niet vinden</h1>
        <p className="mt-2 text-[14.5px] text-muted">Controleer de link in je e-mail, of neem contact op met de afzender.</p>
        {!backendEnabled && <p className="mt-6 text-[12.5px] text-faint">In deze demo werken factuurlinks in dezelfde browser als waarin de factuur is gemaakt.</p>}
      </div>
    );
  }

  const status = invoiceStatus(inv, todayISO());
  const due = amountDue(inv);
  const total = invoiceTotal(inv);
  const paid = status === 'paid' || status === 'credited' || due <= 0;
  const canPayOnline = org.payments.connected && org.payments.payLinkOnInvoice && !paid;

  async function pay() {
    if (!inv) return;
    setPaying(true);
    const result = await startPayment(inv);
    if ('error' in result) {
      setPaying(false);
      toast.error(result.error);
      return;
    }
    if (result.url.startsWith('/')) router.push(result.url);
    else window.location.href = result.url;
  }

  return (
    <div className="animate-fade-in pt-4">
      <div className="flex flex-col items-center text-center">
        <OrgMark org={org} size={60} className="rounded-[18px] shadow-raised" />
        <div className="mt-3 font-display text-[16px] font-semibold">{org.tradeName || org.name}</div>
      </div>

      <div className="mt-8 overflow-hidden rounded-[28px] border border-line bg-surface shadow-pop">
        <div className="h-1.5" style={{ background: org.accentColor }} />
        <div className="p-6 text-center sm:p-10">
          <div className="text-[14px] text-muted">{inv.kind === 'credit' ? 'Creditfactuur' : 'Factuur'} {inv.number}</div>
          <div className="tabular mt-2 font-display text-[44px] font-semibold leading-none tracking-[-0.04em] sm:text-[52px]">{formatEUR(paid ? total : due)}</div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[13.5px] text-muted">
            {paid ? <Badge tone="success" dot>Betaald</Badge> : status === 'overdue' ? <Badge tone="danger" dot>Verlopen</Badge> : status === 'partial' ? <Badge tone="warning" dot>Deels betaald</Badge> : <Badge tone="info" dot>Openstaand</Badge>}
            {!paid && <span className="flex items-center gap-1"><CalendarClock className="size-3.5" /> Vervaldatum {formatDateLong(inv.dueDate)}</span>}
          </div>

          <AnimatePresence>
            {(justPaid || paid) && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mx-auto mt-7 max-w-sm rounded-2xl bg-success-50 p-5 text-success-700 ring-1 ring-success-100">
                <CircleCheck className="mx-auto size-8" />
                <div className="mt-2 font-semibold">{justPaid ? 'Bedankt! Je betaling is ontvangen.' : 'Deze factuur is betaald.'}</div>
                {inv.paidAt && <div className="mt-0.5 text-[13px] opacity-80">Betaald op {formatDateLong(inv.paidAt)}</div>}
              </motion.div>
            )}
          </AnimatePresence>

          {!paid && (
            <div className="mx-auto mt-8 max-w-sm space-y-2.5">
              {canPayOnline && (
                <Button size="lg" className="h-14 w-full text-[16px]" style={{ background: org.accentColor }} loading={paying} onClick={pay}>
                  Betaal {formatEUR(due)}
                </Button>
              )}
              {canPayOnline && <div className="flex items-center justify-center gap-2 text-[12px] text-muted">{org.payments.methods.ideal && <PayMark label="iDEAL" />}{org.payments.methods.bancontact && <PayMark label="Bancontact" />}{org.payments.methods.creditcard && <PayMark label="Creditcard" />}</div>}
            </div>
          )}

          <div className="mx-auto mt-6 grid max-w-sm grid-cols-2 gap-2.5">
            <Button variant="outline" onClick={() => setShowDoc((v) => !v)}><Eye /> Bekijk factuur <ChevronDown className={`transition ${showDoc ? 'rotate-180' : ''}`} /></Button>
            {backendEnabled
              ? <Button variant="outline" asChild><a href={`/api/public/invoice/${token}/pdf`} target="_blank" rel="noreferrer"><Download /> Download PDF</a></Button>
              : <Button variant="outline" onClick={() => downloadPdf(org, customer, invoiceToDoc(inv))}><Download /> Download PDF</Button>}
          </div>
        </div>

        {!paid && org.payments.methods.banktransfer && (
          <div className="border-t border-line bg-subtle/70 px-6 py-5 sm:px-10">
            <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold"><Landmark className="size-4 text-muted" /> Liever zelf overmaken?</div>
            <dl className="grid grid-cols-[110px_1fr_auto] items-center gap-y-1.5 text-[13.5px]">
              {[['Bedrag', formatEUR(due)], ['IBAN', org.iban], ['Ten name van', org.name], ['Kenmerk', inv.number]].map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted">{k}</dt><dd className="truncate font-medium">{v}</dd>
                  <button onClick={() => { navigator.clipboard?.writeText(v); toast.success(`${k} gekopieerd`); }} className="grid size-7 place-items-center rounded-lg text-faint hover:bg-black/5 hover:text-ink" aria-label={`Kopieer ${k}`}><Copy className="size-3.5" /></button>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showDoc && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-5">
            <InvoiceDocument org={org} customer={customer} doc={invoiceToDoc(inv)} className="rounded-[22px] shadow-raised ring-1 ring-line" />
          </motion.div>
        )}
      </AnimatePresence>

      <p className="mt-6 text-center text-[13px] text-muted">Vragen over deze factuur? Mail <a className="font-medium text-ink-2 underline-offset-2 hover:underline" href={`mailto:${org.email}`}>{org.email}</a>{org.phone && <> of bel {org.phone}</>}.</p>
    </div>
  );
}

function PayMark({ label }: { label: string }) {
  return <span className="rounded-md bg-surface px-2 py-0.5 text-[11px] font-semibold text-ink-2 ring-1 ring-line">{label}</span>;
}
