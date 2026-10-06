'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo } from 'react';
import {
  ArrowLeft, Send, Download, CircleCheck, BellRing, Link2, ExternalLink, Pencil, FileX, Eye, Mail, FilePlus, CreditCard,
  Landmark, Hand, Globe, Repeat, FilePenLine,
} from 'lucide-react';
import { toast } from 'sonner';
import { useEmailLogs, useInvoiceRows, useOrg, useStore } from '@/lib/store';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InvoiceStatusBadge } from '@/components/ui/badge';
import { EmptyState, Progress, Avatar } from '@/components/ui/misc';
import { SwitchRow } from '@/components/ui/switch';
import { InvoiceDocument } from '@/components/documents/invoice-document';
import { InvoiceRowMenu, useInvoiceCommands } from '@/components/invoice-actions';
import { invoiceToDoc } from '@/lib/pdf/download';
import { amountPaid } from '@/lib/domain/calc';
import { formatEUR } from '@/lib/domain/money';
import { daysBetween, formatDate, formatDateLong, relativeTime, todayISO } from '@/lib/domain/dates';
import { reminderPlan } from '@/lib/domain/reminders';
import { publicUrl } from '@/lib/services/email';
import { METHOD_LABEL } from '@/components/flows/mark-paid';
import { cn } from '@/lib/utils';

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const rows = useInvoiceRows();
  const row = rows.find((r) => r.inv.id === id);
  const org = useOrg();
  const logs = useEmailLogs();
  const setReminders = useStore((s) => s.setInvoiceReminders);
  const allInvoices = useStore((s) => s.invoices);
  const quote = useStore((s) => s.quotes.find((q) => q.id === row?.inv.quoteId));
  const recurring = useStore((s) => s.recurring.find((r) => r.id === row?.inv.recurringId));
  const cmd = useInvoiceCommands();
  const today = todayISO();

  const mails = useMemo(() => logs.filter((l) => l.invoiceId === id).sort((a, b) => b.sentAt.localeCompare(a.sentAt)), [logs, id]);

  if (!row) {
    return <EmptyState icon={<FileX />} title="Factuur niet gevonden" description="Misschien hoort hij bij een andere administratie." action={<Button asChild><Link href="/facturen">Naar facturen</Link></Button>} />;
  }

  const { inv, customer, status, total, due } = row;
  const paid = amountPaid(inv);
  const creditOf = allInvoices.find((x) => x.id === inv.creditOfId);
  const creditedBy = allInvoices.find((x) => x.id === inv.creditedById);
  const plan = reminderPlan(inv, org);
  const daysLeft = daysBetween(today, inv.dueDate);
  const link = publicUrl(`/f/${inv.publicToken}`);
  const isOpen = ['sent', 'viewed', 'open', 'partial', 'overdue'].includes(status);

  const timeline = [
    { label: 'Aangemaakt', at: inv.createdAt, done: true, icon: <FilePlus /> },
    { label: inv.sentAt ? 'Verzonden per e-mail' : 'Nog niet verzonden', at: inv.sentAt, done: !!inv.sentAt, icon: <Send /> },
    { label: inv.viewedAt ? 'Bekeken door klant' : 'Nog niet bekeken', at: inv.viewedAt, done: !!inv.viewedAt, icon: <Eye /> },
    ...inv.remindersSent.map((r) => ({ label: org.reminders.steps.find((s) => s.id === r.stepId)?.label ?? 'Herinnering', at: r.sentAt, done: true, icon: <BellRing /> })),
    ...inv.payments.map((p) => ({ label: `${formatEUR(p.amount)} ontvangen · ${p.source === 'online' ? 'online' : p.source === 'bank' ? 'via bank' : METHOD_LABEL[p.method].toLowerCase()}`, at: `${p.date}T12:00:00`, done: true, icon: p.source === 'online' ? <Globe /> : p.source === 'bank' ? <Landmark /> : <Hand />, success: true })),
  ];
  if (inv.kind === 'credit' || status === 'draft') timeline.splice(1, 2);

  const primary =
    status === 'draft' ? <Button onClick={() => cmd.send(inv.id)}><Send /> Factuur versturen</Button>
      : status === 'overdue' ? <Button onClick={() => cmd.remind(inv.id)}><BellRing /> Herinnering sturen</Button>
        : isOpen ? <Button variant="success" onClick={() => cmd.markPaid(inv.id)}><CircleCheck /> Markeer betaald</Button>
          : <Button variant="outline" onClick={() => cmd.download(row)}><Download /> Download PDF</Button>;

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild><Link href="/facturen" aria-label="Terug"><ArrowLeft className="!size-5" /></Link></Button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-display text-[24px] font-semibold sm:text-[28px]">{inv.kind === 'credit' ? 'Creditfactuur ' : 'Factuur '}{inv.number || 'concept'}</h1>
              <InvoiceStatusBadge status={status} />
            </div>
            <Link href={`/klanten/${customer?.id}`} className="text-[14px] text-muted hover:text-brand-600">{customer?.companyName}</Link>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {status === 'draft' && <Button variant="outline" asChild><Link href={`/facturen/${inv.id}/bewerken`}><Pencil /> Bewerken</Link></Button>}
          {status !== 'draft' && <Button variant="outline" onClick={() => cmd.download(row)} className="hidden sm:inline-flex"><Download /> PDF</Button>}
          {status !== 'draft' && status !== 'paid' && status !== 'credited' && <Button variant="outline" onClick={() => cmd.send(inv.id)} className="hidden sm:inline-flex"><Send /> Opnieuw versturen</Button>}
          {primary}
          <InvoiceRowMenu row={row} className="size-10 rounded-[12px] border border-line-strong bg-surface shadow-card" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0">
          <InvoiceDocument org={org} customer={customer} doc={invoiceToDoc(inv)} className="rounded-[20px] shadow-raised ring-1 ring-line" />
        </div>

        <div className="space-y-4">
          {/* Amount + progress */}
          <Card className="overflow-hidden p-5">
            <div className="text-[13px] font-medium text-muted">{status === 'paid' ? 'Volledig betaald' : status === 'credited' ? 'Gecrediteerd' : status === 'draft' ? 'Totaal' : 'Nog te ontvangen'}</div>
            <div className="tabular mt-1 font-display text-[34px] font-semibold tracking-[-0.03em]">{formatEUR(status === 'paid' || status === 'draft' || status === 'credited' ? total : due)}</div>
            {isOpen && (
              <>
                <Progress value={(paid / total) * 100} tone={status === 'overdue' ? 'danger' : 'success'} className="mt-4" />
                <div className="mt-2 flex justify-between text-[12.5px] text-muted">
                  <span>{formatEUR(paid)} van {formatEUR(total)} betaald</span>
                  <span className={cn(status === 'overdue' && 'font-medium text-danger-600')}>{daysLeft < 0 ? `${-daysLeft} dagen te laat` : daysLeft === 0 ? 'vervalt vandaag' : `nog ${daysLeft} dagen`}</span>
                </div>
              </>
            )}
            {status === 'paid' && inv.paidAt && <div className="mt-2 flex items-center gap-1.5 text-[13px] text-success-700"><CircleCheck className="size-4" /> Betaald op {formatDateLong(inv.paidAt)}</div>}
            {creditOf && <Link href={`/facturen/${creditOf.id}`} className="mt-3 flex items-center gap-2 rounded-xl bg-subtle px-3 py-2.5 text-[13px] ring-1 ring-line hover:bg-black/[0.03]"><FileX className="size-4 text-muted" />Crediteert factuur <span className="font-medium">{creditOf.number}</span></Link>}
            {creditedBy && <Link href={`/facturen/${creditedBy.id}`} className="mt-3 flex items-center gap-2 rounded-xl bg-subtle px-3 py-2.5 text-[13px] ring-1 ring-line hover:bg-black/[0.03]"><FileX className="size-4 text-muted" />Gecrediteerd met <span className="font-medium">{creditedBy.number}</span></Link>}
            {quote && <Link href={`/offertes/${quote.id}`} className="mt-3 flex items-center gap-2 rounded-xl bg-subtle px-3 py-2.5 text-[13px] ring-1 ring-line hover:bg-black/[0.03]"><FilePenLine className="size-4 text-muted" />Gemaakt van offerte <span className="font-medium">{quote.number}</span></Link>}
            {recurring && <Link href="/periodiek" className="mt-3 flex items-center gap-2 rounded-xl bg-subtle px-3 py-2.5 text-[13px] ring-1 ring-line hover:bg-black/[0.03]"><Repeat className="size-4 text-muted" />Periodieke factuur · {recurring.name}</Link>}
          </Card>

          {/* Online link */}
          {status !== 'draft' && inv.kind === 'invoice' && (
            <Card className="p-5">
              <div className="flex items-center gap-2 text-[14px] font-semibold"><Link2 className="size-4 text-brand-600" /> Online factuur & betaallink</div>
              <p className="mt-1 text-[12.5px] text-muted">Je klant bekijkt de factuur en betaalt direct met {org.payments.methods.ideal ? 'iDEAL' : 'een overboeking'}.</p>
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-subtle p-1.5 pl-3 ring-1 ring-line">
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink-2">{link.replace(/^https?:\/\//, '')}</span>
                <Button size="sm" variant="outline" onClick={() => cmd.copyLink(inv.publicToken)}>Kopieer</Button>
              </div>
              <Button variant="ghost" size="sm" asChild className="mt-2 -ml-2"><a href={`/f/${inv.publicToken}`} target="_blank" rel="noreferrer"><ExternalLink /> Bekijk als klant</a></Button>
            </Card>
          )}

          {/* Timeline */}
          <Card>
            <CardHeader title="Tijdlijn" />
            <ol className="relative px-5 pb-5 pt-4">
              {timeline.map((t, i) => (
                <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
                  {i < timeline.length - 1 && <span className="absolute left-[15px] top-8 h-[calc(100%-24px)] w-px bg-line" />}
                  <span className={cn('relative grid size-8 shrink-0 place-items-center rounded-full ring-4 ring-surface [&_svg]:size-3.5', 'success' in t && t.success ? 'bg-success-50 text-success-600' : t.done ? 'bg-brand-50 text-brand-600' : 'bg-subtle text-faint')}>{t.icon}</span>
                  <div className="pt-1">
                    <div className={cn('text-[13.5px]', t.done ? 'font-medium text-ink' : 'text-muted')}>{t.label}</div>
                    {t.at && <div className="text-[12px] text-muted">{relativeTime(t.at)}</div>}
                  </div>
                </li>
              ))}
            </ol>
          </Card>

          {/* Reminders */}
          {inv.kind === 'invoice' && status !== 'draft' && status !== 'credited' && (
            <Card className="px-5">
              <SwitchRow
                icon={<BellRing />}
                title="Automatische herinneringen"
                description={!org.reminders.enabled ? 'Staat uit voor deze administratie (Instellingen → Herinneringen).' : customer && !customer.remindersEnabled ? `Staat uit voor ${customer.companyName}.` : status === 'paid' ? 'Gestopt: de factuur is betaald.' : 'We sturen vriendelijke herinneringen met betaallink.'}
                checked={inv.remindersEnabled && org.reminders.enabled && (customer?.remindersEnabled ?? true)}
                disabled={!org.reminders.enabled || (customer && !customer.remindersEnabled) || status === 'paid'}
                onCheckedChange={(v) => { setReminders(inv.id, v); toast.success(v ? 'Herinneringen staan aan' : 'Herinneringen voor deze factuur staan uit'); }}
              />
              {status !== 'paid' && inv.remindersEnabled && org.reminders.enabled && (
                <ul className="-mt-1 space-y-2 border-t border-line py-4">
                  {plan.map((p) => (
                    <li key={p.step.id} className="flex items-center justify-between text-[13px]">
                      <span className={cn(p.sentAt ? 'text-ink' : 'text-muted')}>{p.step.label}</span>
                      <span className={cn('tabular', p.sentAt ? 'text-success-600' : 'text-muted')}>{p.sentAt ? `verstuurd ${formatDate(p.sentAt.slice(0, 10))}` : formatDate(p.date)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {/* E-mails */}
          {mails.length > 0 && (
            <Card>
              <CardHeader title="Verstuurde e-mails" />
              <ul className="p-2 pt-3">
                {mails.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
                    <span className="grid size-8 place-items-center rounded-[10px] bg-subtle text-muted ring-1 ring-line"><Mail className="size-3.5" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-medium">{m.subject}</div>
                      <div className="truncate text-[12px] text-muted">aan {m.to} · {relativeTime(m.sentAt)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {customer && (
            <Card className="flex items-center gap-3 p-4">
              <Avatar name={customer.companyName} size={40} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold">{customer.companyName}</div>
                <div className="truncate text-[12.5px] text-muted">{customer.email}</div>
              </div>
              <Button size="sm" variant="outline" asChild><Link href={`/klanten/${customer.id}`}>Klant</Link></Button>
            </Card>
          )}
          {org.payments.connected && isOpen && (
            <div className="flex items-center gap-2 px-1 text-[12px] text-muted"><CreditCard className="size-3.5" /> Online betalingen via Mollie zetten de factuur automatisch op betaald.</div>
          )}
        </div>
      </div>
    </div>
  );
}
