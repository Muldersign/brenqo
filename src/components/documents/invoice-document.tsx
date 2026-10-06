import type { Customer, DocumentLine, Organization } from '@/lib/types';
import { documentTotals, lineNet } from '@/lib/domain/calc';
import { formatEUR, formatNumber } from '@/lib/domain/money';
import { formatDateLong } from '@/lib/domain/dates';
import { OrgMark } from '@/components/shell/org-switcher';
import { cn } from '@/lib/utils';

export interface DocumentData {
  kind: 'invoice' | 'credit' | 'quote';
  number: string;
  issueDate: string;
  dueDate: string;
  reference: string;
  lines: DocumentLine[];
  note: string;
  paidAmount?: number;
  creditOfNumber?: string;
}

/**
 * The invoice/quote as the customer sees it. Modern, but with everything a
 * Dutch invoice legally needs: unique number, dates, both parties, KvK and
 * btw-nummer, description, quantity, price, btw per rate and totals.
 */
export function InvoiceDocument({ org, customer, doc, className }: { org: Organization; customer?: Customer; doc: DocumentData; className?: string }) {
  const t = documentTotals(doc.lines);
  const title = doc.kind === 'quote' ? 'Offerte' : doc.kind === 'credit' ? 'Creditfactuur' : 'Factuur';
  const anyDiscount = doc.lines.some((l) => l.discountPct);
  const noVat = !org.vatRegistered;

  return (
    <div className={cn('relative overflow-hidden bg-white text-[#1d1d24]', className)} style={{ ['--accent' as string]: org.accentColor }}>
      <div className="h-1" style={{ background: org.accentColor }} />
      <div className="px-7 py-8 sm:px-12 sm:py-11">
        <div className="flex flex-col-reverse justify-between gap-6 sm:flex-row sm:items-start">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em]" style={{ color: org.accentColor }}>{title}</div>
            <div className="mt-1 text-[30px] font-semibold tracking-[-0.04em]">{doc.number || 'Concept'}</div>
          </div>
          <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:gap-2">
            <OrgMark org={org} size={44} className="rounded-[12px]" />
            <div className="font-display text-[15px] font-semibold sm:text-right">{org.tradeName || org.name}</div>
          </div>
        </div>

        <div className="mt-10 grid gap-8 text-[13px] leading-relaxed sm:grid-cols-[1fr_1fr_auto]">
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#9a9aa6]">Aan</div>
            {customer ? (
              <>
                <div className="font-semibold">{customer.companyName}</div>
                {customer.contactName && customer.contactName !== customer.companyName && <div>t.a.v. {customer.contactName}</div>}
                <div>{customer.address}</div>
                <div>{customer.postalCode} {customer.city}</div>
                {customer.country && customer.country !== 'Nederland' && <div>{customer.country}</div>}
                {customer.vatNumber && <div className="text-[#6b6b76]">Btw: {customer.vatNumber}</div>}
              </>
            ) : <div className="text-[#9a9aa6]">Nog geen klant gekozen</div>}
          </div>
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#9a9aa6]">Van</div>
            <div className="font-semibold">{org.name}</div>
            <div>{org.address}</div>
            <div>{org.postalCode} {org.city}</div>
            <div className="text-[#6b6b76]">{org.email}</div>
          </div>
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 sm:justify-end">
            <span className="text-[#9a9aa6]">{doc.kind === 'quote' ? 'Offertedatum' : 'Factuurdatum'}</span><span className="whitespace-nowrap text-right font-medium">{formatDateLong(doc.issueDate)}</span>
            {doc.kind !== 'credit' && <><span className="text-[#9a9aa6]">{doc.kind === 'quote' ? 'Geldig tot' : 'Vervaldatum'}</span><span className="whitespace-nowrap text-right font-medium">{formatDateLong(doc.dueDate)}</span></>}
            {doc.reference && <><span className="text-[#9a9aa6]">Kenmerk</span><span className="text-right font-medium">{doc.reference}</span></>}
          </div>
        </div>

        <div className="mt-10">
          <div className={cn('grid gap-3 border-b border-[#ececf1] pb-2.5 text-[11px] font-semibold uppercase tracking-wider text-[#9a9aa6]', anyDiscount ? 'grid-cols-[1fr_70px_90px_60px_100px]' : 'grid-cols-[1fr_70px_90px_100px]')}>
            <span>Omschrijving</span><span className="text-right">Aantal</span><span className="text-right">Prijs</span>{anyDiscount && <span className="text-right">Korting</span>}<span className="text-right">Bedrag</span>
          </div>
          {doc.lines.map((l) => (
            <div key={l.id} className={cn('grid items-baseline gap-3 border-b border-[#f3f3f6] py-3.5 text-[13.5px]', anyDiscount ? 'grid-cols-[1fr_70px_90px_60px_100px]' : 'grid-cols-[1fr_70px_90px_100px]')}>
              <div className="min-w-0">
                <div className="font-medium">{l.description || <span className="text-[#b4b4bd]">Omschrijving</span>}</div>
                {!noVat && <div className="text-[12px] text-[#9a9aa6]">{l.vatRate}% btw</div>}
              </div>
              <span className="tabular text-right text-[#45454f]">{formatNumber(l.quantity)} {l.unit}</span>
              <span className="tabular text-right text-[#45454f]">{formatEUR(l.unitPrice)}</span>
              {anyDiscount && <span className="tabular text-right text-[#45454f]">{l.discountPct ? `${l.discountPct}%` : '—'}</span>}
              <span className="tabular text-right font-medium">{formatEUR(lineNet(l))}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end">
          <div className="w-full max-w-[300px] space-y-2 text-[13.5px]">
            <div className="flex justify-between"><span className="text-[#6b6b76]">Subtotaal</span><span className="tabular">{formatEUR(t.subtotal)}</span></div>
            {!noVat && t.vatByRate.map((r) => (
              <div key={r.rate} className="flex justify-between"><span className="text-[#6b6b76]">Btw {r.rate}% over {formatEUR(r.base)}</span><span className="tabular">{formatEUR(r.vat)}</span></div>
            ))}
            <div className="mt-3 flex items-baseline justify-between border-t border-[#ececf1] pt-3">
              <span className="font-semibold">Totaal</span>
              <span className="tabular font-display text-[22px] font-semibold tracking-[-0.02em]">{formatEUR(t.total)}</span>
            </div>
            {!!doc.paidAmount && doc.paidAmount > 0 && (
              <>
                <div className="flex justify-between text-success-700"><span>Al betaald</span><span className="tabular">− {formatEUR(doc.paidAmount)}</span></div>
                <div className="flex justify-between font-semibold"><span>Nog te betalen</span><span className="tabular">{formatEUR(t.total - doc.paidAmount)}</span></div>
              </>
            )}
          </div>
        </div>

        {(doc.note || noVat) && (
          <div className="mt-10 rounded-2xl bg-[#f8f8fa] p-5 text-[13px] leading-relaxed text-[#45454f]">
            {doc.note}
            {noVat && <div className={doc.note ? 'mt-2 text-[#9a9aa6]' : 'text-[#9a9aa6]'}>Vrijgesteld van btw.</div>}
          </div>
        )}

        {doc.kind === 'invoice' && (
          <div className="mt-8 text-[13px] leading-relaxed text-[#45454f]">
            Graag ontvangen wij het bedrag van <span className="font-semibold text-[#1d1d24]">{formatEUR(t.total - (doc.paidAmount ?? 0))}</span> vóór {formatDateLong(doc.dueDate)} op rekening{' '}
            <span className="font-semibold text-[#1d1d24]">{org.iban}</span> t.n.v. {org.name}, onder vermelding van factuurnummer {doc.number || '…'}.
          </div>
        )}

        <div className="mt-12 grid gap-4 border-t border-[#ececf1] pt-5 text-[11.5px] leading-relaxed text-[#9a9aa6] sm:grid-cols-4">
          <div><div className="font-semibold text-[#6b6b76]">{org.name}</div>{org.address}, {org.postalCode} {org.city}</div>
          <div><div className="font-semibold text-[#6b6b76]">Contact</div>{org.email}<br />{org.phone}</div>
          <div><div className="font-semibold text-[#6b6b76]">Bank</div>{org.iban}{org.bic && <><br />BIC {org.bic}</>}</div>
          <div><div className="font-semibold text-[#6b6b76]">Registratie</div>KvK {org.kvk || '—'}{org.vatNumber && <><br />Btw {org.vatNumber}</>}</div>
        </div>
      </div>
    </div>
  );
}
