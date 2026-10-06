'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Check, X, Download, FileX, CalendarClock, LoaderCircle } from 'lucide-react';
import { usePublicQuote } from '@/lib/public/hooks';
import { PublicShell } from '@/components/public-shell';
import { Button } from '@/components/ui/button';
import { QuoteStatusBadge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/input';
import { InvoiceDocument } from '@/components/documents/invoice-document';
import { OrgMark } from '@/components/shell/org-switcher';
import { downloadPdf, quoteToDoc } from '@/lib/pdf/download';
import { documentTotals } from '@/lib/domain/calc';
import { quoteStatus } from '@/lib/domain/status';
import { formatEUR } from '@/lib/domain/money';
import { formatDateLong, todayISO } from '@/lib/domain/dates';

export default function PublicQuotePage() {
  return <PublicShell><PublicQuote /></PublicShell>;
}

function PublicQuote() {
  const { token } = useParams<{ token: string }>();
  const { state: view, respond } = usePublicQuote(token);
  const [declining, setDeclining] = useState(false);
  const [confirming, setConfirming] = useState(false);
  if (view.status === 'loading') return <div className="flex flex-col items-center gap-3 pt-24 text-muted"><LoaderCircle className="size-5 animate-spin" />Offerte wordt geladen…</div>;
  const quote = view.status === 'ready' ? view.quote : undefined;
  const org = view.status === 'ready' ? view.org : undefined;
  const customer = view.status === 'ready' ? view.customer : undefined;

  if (!quote || !org || quote.state === 'draft') {
    return <div className="pt-16 text-center"><FileX className="mx-auto size-8 text-muted" /><h1 className="mt-4 font-display text-[22px] font-semibold">Offerte niet gevonden</h1></div>;
  }
  const status = quoteStatus(quote, todayISO());
  const total = documentTotals(quote.lines).total;

  return (
    <div className="animate-fade-in pt-4">
      <div className="flex flex-col items-center text-center">
        <OrgMark org={org} size={60} className="rounded-[18px] shadow-raised" />
        <div className="mt-3 font-display text-[16px] font-semibold">{org.tradeName || org.name}</div>
      </div>
      <div className="mt-8 overflow-hidden rounded-[28px] border border-line bg-surface p-6 text-center shadow-pop sm:p-10">
        <div className="text-[14px] text-muted">Offerte {quote.number} voor {customer?.companyName}</div>
        <div className="tabular mt-2 font-display text-[44px] font-semibold leading-none tracking-[-0.04em]">{formatEUR(total)}</div>
        <div className="mt-4 flex items-center justify-center gap-2 text-[13.5px] text-muted"><QuoteStatusBadge status={status} />{status === 'sent' && <span className="flex items-center gap-1"><CalendarClock className="size-3.5" /> Geldig tot {formatDateLong(quote.validUntil)}</span>}</div>
        {status === 'sent' && (
          <div className="mx-auto mt-8 grid max-w-sm gap-2.5">
            <Button size="lg" variant="success" className="h-14 text-[16px]" onClick={() => setConfirming(true)}><Check /> Accepteren</Button>
            <Button variant="ghost" onClick={() => setDeclining(true)}><X /> Afwijzen</Button>
          </div>
        )}
        {(status === 'accepted' || status === 'invoiced') && <div className="mx-auto mt-7 max-w-sm rounded-2xl bg-success-50 p-5 text-success-700 ring-1 ring-success-100"><Check className="mx-auto size-7" /><div className="mt-2 font-semibold">Bedankt! Je hebt de offerte geaccepteerd.</div><div className="text-[13px] opacity-80">{org.name} neemt contact met je op.</div></div>}
        {status === 'declined' && <div className="mx-auto mt-7 max-w-sm rounded-2xl bg-subtle p-5 text-ink-2 ring-1 ring-line">Je hebt deze offerte afgewezen. Bedankt voor je reactie.</div>}
        <Button variant="outline" className="mt-6" onClick={() => downloadPdf(org, customer, quoteToDoc(quote))}><Download /> Download PDF</Button>
      </div>
      <div className="mt-5"><InvoiceDocument org={org} customer={customer} doc={quoteToDoc(quote)} className="rounded-[22px] shadow-raised ring-1 ring-line" /></div>

      <Modal open={confirming} onOpenChange={setConfirming} title="Offerte accepteren?" description={`Je gaat akkoord met offerte ${quote.number} van ${formatEUR(total)}.`} size="sm" footer={<><Button variant="outline" onClick={() => setConfirming(false)}>Annuleren</Button><Button variant="success" onClick={async () => { await respond(true); setConfirming(false); }}><Check /> Ja, accepteren</Button></>}>
        <p className="text-[13.5px] text-muted">{org.name} krijgt direct bericht.</p>
      </Modal>
      <Modal open={declining} onOpenChange={setDeclining} title="Offerte afwijzen" size="sm" footer={<><Button variant="outline" onClick={() => setDeclining(false)}>Annuleren</Button><Button variant="danger" onClick={async () => { await respond(false); setDeclining(false); }}>Afwijzen</Button></>}>
        <Textarea placeholder="Wil je laten weten waarom? (optioneel)" />
      </Modal>
    </div>
  );
}
