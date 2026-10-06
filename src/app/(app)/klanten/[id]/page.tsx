'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { ArrowLeft, FilePlus, Mail, Pencil, Phone, MapPin, Building, Landmark, FileText, Hash, Trash, FilePenLine, BellOff } from 'lucide-react';
import { toast } from 'sonner';
import { useInvoiceRows, useStore } from '@/lib/store';
import { useUI } from '@/lib/store/ui';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InvoiceStatusBadge } from '@/components/ui/badge';
import { Avatar, EmptyState } from '@/components/ui/misc';
import { formatEUR } from '@/lib/domain/money';
import { daysBetween, formatDate } from '@/lib/domain/dates';
import { isOutstanding } from '@/lib/domain/status';

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const customer = useStore((s) => s.customers.find((c) => c.id === id && c.organizationId === s.activeOrgId));
  const deleteCustomer = useStore((s) => s.deleteCustomer);
  const setUI = useUI((s) => s.set);
  const allRows = useInvoiceRows();
  const rows = useMemo(() => allRows.filter((r) => r.inv.customerId === id), [allRows, id]);

  if (!customer) return <EmptyState icon={<Building />} title="Klant niet gevonden" action={<Button asChild><Link href="/klanten">Naar klanten</Link></Button>} />;

  const final = rows.filter((r) => r.status !== 'draft' && r.status !== 'credited');
  const revenue = final.reduce((s, r) => s + r.total, 0);
  const open = rows.filter((r) => isOutstanding(r.status)).reduce((s, r) => s + r.due, 0);
  const paid = rows.filter((r) => r.status === 'paid' && r.inv.kind === 'invoice');
  const avgDays = paid.length ? Math.round(paid.reduce((s, r) => s + daysBetween(r.inv.issueDate, r.inv.paidAt ?? r.inv.issueDate), 0) / paid.length) : null;

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild className="hidden sm:inline-flex"><Link href="/klanten" aria-label="Terug"><ArrowLeft className="!size-5" /></Link></Button>
          <Avatar name={customer.companyName} size={56} />
          <div className="min-w-0">
            <h1 className="truncate font-display text-[24px] font-semibold sm:text-[28px]">{customer.companyName}</h1>
            <div className="text-[14px] text-muted">{[customer.contactName, customer.city].filter(Boolean).join(' · ')}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild><Link href={`/facturen/nieuw?klant=${customer.id}`}><FilePlus /> Nieuwe factuur</Link></Button>
          {customer.email && <Button variant="outline" asChild><a href={`mailto:${customer.email}`}><Mail /> E-mail</a></Button>}
          <Button variant="outline" onClick={() => setUI({ customerDrawer: { open: true, id: customer.id } })}><Pencil /> Bewerk klant</Button>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['Totale omzet', formatEUR(revenue)],
          ['Openstaand', formatEUR(open)],
          ['Betaalde facturen', String(paid.length)],
          ['Betaalt gemiddeld na', avgDays === null ? '—' : `${avgDays} dagen`],
        ].map(([l, v], i) => (
          <Card key={l} className="p-4 sm:p-5">
            <div className="text-[13px] text-muted">{l}</div>
            <div className={`tabular mt-1 font-display text-[20px] font-semibold tracking-[-0.02em] sm:text-[24px] ${i === 1 && open > 0 ? 'text-ink' : ''}`}>{v}</div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="overflow-hidden">
          <CardHeader title="Facturen" description={`${rows.length} in totaal`} action={<Button size="sm" variant="ghost" asChild><Link href={`/offertes/nieuw?klant=${customer.id}`}><FilePenLine /> Offerte</Link></Button>} />
          {rows.length === 0 ? (
            <EmptyState compact icon={<FileText />} title="Nog geen facturen" description={`Maak de eerste factuur voor ${customer.companyName}.`} action={<Button asChild><Link href={`/facturen/nieuw?klant=${customer.id}`}><FilePlus /> Nieuwe factuur</Link></Button>} />
          ) : (
            <ul className="mt-3">
              {rows.map((r) => (
                <li key={r.inv.id}>
                  <Link href={`/facturen/${r.inv.id}`} className="flex items-center gap-4 border-t border-line/70 px-5 py-3.5 transition hover:bg-subtle/70 sm:px-6">
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-medium tabular">{r.inv.number || 'Concept'}</div>
                      <div className="truncate text-[12.5px] text-muted">{formatDate(r.inv.issueDate)} · {r.inv.lines[0]?.description}</div>
                    </div>
                    <span className="tabular text-[14px] font-semibold">{formatEUR(r.total)}</span>
                    <InvoiceStatusBadge status={r.status} className="hidden sm:inline-flex" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="mb-3 text-[14px] font-semibold">Gegevens</div>
            <dl className="space-y-3 text-[13.5px]">
              {[
                [<Mail key="m" />, customer.email],
                [<Phone key="p" />, customer.phone],
                [<MapPin key="a" />, [customer.address, `${customer.postalCode} ${customer.city}`.trim(), customer.country !== 'Nederland' ? customer.country : ''].filter(Boolean).join(', ')],
                [<Building key="k" />, customer.kvk && `KvK ${customer.kvk}`],
                [<Hash key="v" />, customer.vatNumber && `Btw ${customer.vatNumber}`],
                [<Landmark key="i" />, customer.iban],
              ].filter(([, v]) => v).map(([icon, v], i) => (
                <div key={i} className="flex items-start gap-3 [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-faint">{icon as React.ReactNode}<span className="break-all text-ink-2">{v as string}</span></div>
              ))}
            </dl>
            <div className="mt-4 border-t border-line pt-4 text-[13px] text-muted">
              Betaaltermijn <span className="font-medium text-ink">{customer.paymentTermDays} dagen</span>
              {!customer.remindersEnabled && <div className="mt-2 flex items-center gap-1.5"><BellOff className="size-3.5" /> Geen automatische herinneringen</div>}
            </div>
          </Card>
          {customer.defaultInvoiceText && <Card className="p-5 text-[13px] text-ink-2"><div className="mb-1 font-semibold text-ink">Standaard factuurtekst</div>{customer.defaultInvoiceText}</Card>}
          {rows.length === 0 && (
            <Button variant="ghost" size="sm" className="text-danger-600" onClick={() => { deleteCustomer(customer.id); toast.success('Klant verwijderd'); router.push('/klanten'); }}><Trash /> Klant verwijderen</Button>
          )}
        </div>
      </div>
    </div>
  );
}
