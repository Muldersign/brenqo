'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, Send, Download, FileText, ExternalLink, Check, X, Trash, FilePenLine, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { useOrg, useStore } from '@/lib/store';
import { useUI } from '@/lib/store/ui';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { QuoteStatusBadge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/misc';
import { InvoiceDocument } from '@/components/documents/invoice-document';
import { DocumentEditor } from '@/components/documents/document-editor';
import { downloadPdf, quoteToDoc } from '@/lib/pdf/download';
import { documentTotals } from '@/lib/domain/calc';
import { quoteStatus } from '@/lib/domain/status';
import { formatEUR } from '@/lib/domain/money';
import { formatDateLong, relativeTime, todayISO } from '@/lib/domain/dates';
import { publicUrl } from '@/lib/services/email';

export default function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const org = useOrg();
  const quote = useStore((s) => s.quotes.find((q) => q.id === id && q.organizationId === s.activeOrgId));
  const customer = useStore((s) => s.customers.find((c) => c.id === quote?.customerId));
  const convert = useStore((s) => s.convertQuoteToInvoice);
  const deleteQuote = useStore((s) => s.deleteQuote);
  const saveQuote = useStore((s) => s.saveQuote);
  const setUI = useUI((s) => s.set);
  const [editing, setEditing] = useState(false);

  if (!quote) return <EmptyState icon={<FilePenLine />} title="Offerte niet gevonden" action={<Button asChild><Link href="/offertes">Naar offertes</Link></Button>} />;
  if (editing) return <DocumentEditor mode="quote" initial={{ id: quote.id, customerId: quote.customerId, issueDate: quote.issueDate, dueDate: quote.validUntil, reference: quote.reference, lines: quote.lines, note: quote.note, number: quote.number }} />;

  const status = quoteStatus(quote, todayISO());
  const total = documentTotals(quote.lines).total;

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild><Link href="/offertes" aria-label="Terug"><ArrowLeft className="!size-5" /></Link></Button>
          <div>
            <div className="flex items-center gap-2.5"><h1 className="font-display text-[24px] font-bold sm:text-[28px]">Offerte {quote.number}</h1><QuoteStatusBadge status={status} /></div>
            <div className="text-[14px] text-muted">{customer?.companyName} · {formatEUR(total)}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(status === 'draft' || status === 'sent') && <Button variant="outline" onClick={() => setEditing(true)}><Pencil /> Bewerken</Button>}
          <Button variant="outline" onClick={() => downloadPdf(org, customer, quoteToDoc(quote))}><Download /> PDF</Button>
          {status === 'draft' && <Button onClick={() => setUI({ sendQuoteId: quote.id })}><Send /> Offerte versturen</Button>}
          {status === 'sent' && <Button variant="outline" onClick={() => setUI({ sendQuoteId: quote.id })}><Send /> Opnieuw versturen</Button>}
          {(status === 'accepted' || status === 'sent') && (
            <Button onClick={() => { const iid = convert(quote.id); toast.success('Factuur gemaakt van offerte', { description: 'Controleer hem even en verstuur.' }); router.push(`/facturen/${iid}`); }}>
              <FileText /> Omzetten naar factuur
            </Button>
          )}
          {status === 'invoiced' && <Button asChild><Link href={`/facturen/${quote.invoiceId}`}><FileText /> Bekijk factuur</Link></Button>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <InvoiceDocument org={org} customer={customer} doc={quoteToDoc(quote)} className="rounded-[20px] shadow-raised ring-1 ring-line" />
        <div className="space-y-4">
          {status === 'accepted' && (
            <Card className="border-success-100 bg-success-50/50 p-5">
              <div className="flex items-center gap-2 font-semibold text-success-700"><Check className="size-4" /> Geaccepteerd</div>
              <p className="mt-1 text-[13px] text-ink-2">{customer?.companyName} heeft de offerte {quote.respondedAt ? relativeTime(quote.respondedAt) : ''} online geaccepteerd. Zet hem om naar een factuur zodra het werk klaar is.</p>
            </Card>
          )}
          {status !== 'draft' && (
            <Card className="p-5">
              <div className="text-[14px] font-semibold">Online offerte</div>
              <p className="mt-1 text-[12.5px] text-muted">Je klant kan de offerte hier bekijken en accepteren of afwijzen.</p>
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-subtle p-1.5 pl-3 ring-1 ring-line">
                <span className="min-w-0 flex-1 truncate text-[13px]">{publicUrl(`/o/${quote.publicToken}`).replace(/^https?:\/\//, '')}</span>
                <Button size="sm" variant="outline" onClick={() => { navigator.clipboard?.writeText(publicUrl(`/o/${quote.publicToken}`)); toast.success('Link gekopieerd'); }}>Kopieer</Button>
              </div>
              <Button variant="ghost" size="sm" asChild className="mt-2 -ml-2"><a href={`/o/${quote.publicToken}`} target="_blank" rel="noreferrer"><ExternalLink /> Bekijk als klant</a></Button>
            </Card>
          )}
          <Card className="space-y-2 p-5 text-[13.5px]">
            <div className="flex justify-between"><span className="text-muted">Offertedatum</span><span>{formatDateLong(quote.issueDate)}</span></div>
            <div className="flex justify-between"><span className="text-muted">Geldig tot</span><span>{formatDateLong(quote.validUntil)}</span></div>
            {quote.sentAt && <div className="flex justify-between"><span className="text-muted">Verstuurd</span><span>{relativeTime(quote.sentAt)}</span></div>}
          </Card>
          {status === 'sent' && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => { saveQuote({ ...quote, state: 'accepted', respondedAt: new Date().toISOString() }); toast.success('Gemarkeerd als geaccepteerd'); }}><Check /> Geaccepteerd</Button>
              <Button variant="outline" size="sm" className="flex-1" onClick={() => { saveQuote({ ...quote, state: 'declined', respondedAt: new Date().toISOString() }); toast('Gemarkeerd als afgewezen'); }}><X /> Afgewezen</Button>
            </div>
          )}
          {status === 'draft' && <Button variant="ghost" size="sm" className="text-danger-600" onClick={() => { deleteQuote(quote.id); router.push('/offertes'); toast.success('Offerte verwijderd'); }}><Trash /> Verwijderen</Button>}
        </div>
      </div>
    </div>
  );
}
