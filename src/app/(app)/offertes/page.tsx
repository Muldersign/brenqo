'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { FilePenLine, Plus } from 'lucide-react';
import { useCustomerMap, useQuotes } from '@/lib/store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { QuoteStatusBadge } from '@/components/ui/badge';
import { Avatar, EmptyState, PageHeader, Segmented } from '@/components/ui/misc';
import { documentTotals } from '@/lib/domain/calc';
import { quoteStatus, type QuoteStatus } from '@/lib/domain/status';
import { formatEUR } from '@/lib/domain/money';
import { formatDate, todayISO } from '@/lib/domain/dates';

export default function QuotesPage() {
  const quotes = useQuotes();
  const customers = useCustomerMap();
  const today = todayISO();
  const [filter, setFilter] = useState<'all' | QuoteStatus>('all');
  const rows = useMemo(() => quotes
    .map((q) => ({ q, c: customers.get(q.customerId), status: quoteStatus(q, today), total: documentTotals(q.lines).total }))
    .sort((a, b) => b.q.number.localeCompare(a.q.number)), [quotes, customers, today]);
  const visible = rows.filter((r) => filter === 'all' || r.status === filter);
  const pipeline = rows.filter((r) => r.status === 'sent').reduce((s, r) => s + r.total, 0);
  const accepted = rows.filter((r) => r.status === 'accepted' || r.status === 'invoiced');
  const decided = rows.filter((r) => ['accepted', 'invoiced', 'declined'].includes(r.status)).length;

  return (
    <div className="animate-fade-in">
      <PageHeader title="Offertes" description="Verstuur een offerte; je klant accepteert online en jij zet hem met één klik om naar een factuur." actions={<Button asChild><Link href="/offertes/nieuw"><Plus strokeWidth={2.5} /> Nieuwe offerte</Link></Button>} />
      {rows.length > 0 && (
        <div className="mb-5 grid grid-cols-3 gap-3">
          <Card className="p-4"><div className="text-[13px] text-muted">Wacht op reactie</div><div className="tabular mt-1 font-display text-[20px] font-semibold sm:text-[22px]">{formatEUR(pipeline, { round: true })}</div></Card>
          <Card className="p-4"><div className="text-[13px] text-muted">Geaccepteerd</div><div className="mt-1 font-display text-[20px] font-semibold sm:text-[22px]">{accepted.length}</div></Card>
          <Card className="p-4"><div className="text-[13px] text-muted">Slagingskans</div><div className="mt-1 font-display text-[20px] font-semibold sm:text-[22px]">{decided ? Math.round((accepted.length / decided) * 100) : 0}%</div></Card>
        </div>
      )}
      <Card className="overflow-hidden">
        <div className="border-b border-line p-4">
          <Segmented value={filter} onChange={setFilter} options={[
            { value: 'all', label: 'Alle', count: rows.length },
            { value: 'draft', label: 'Concept' },
            { value: 'sent', label: 'Verzonden' },
            { value: 'accepted', label: 'Geaccepteerd' },
            { value: 'declined', label: 'Afgewezen' },
            { value: 'expired', label: 'Verlopen' },
          ]} />
        </div>
        {visible.length === 0 ? (
          <EmptyState icon={<FilePenLine />} title={rows.length ? 'Geen offertes met deze status' : 'Nog geen offertes'} description="Maak een offerte met dezelfde editor als je facturen." action={!rows.length && <Button asChild><Link href="/offertes/nieuw"><Plus /> Eerste offerte maken</Link></Button>} />
        ) : (
          <ul>
            {visible.map(({ q, c, status, total }) => (
              <li key={q.id}>
                <Link href={`/offertes/${q.id}`} className="flex items-center gap-4 border-b border-line/70 px-5 py-4 transition last:border-0 hover:bg-subtle/70">
                  <Avatar name={c?.companyName ?? '?'} size={38} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14.5px] font-medium">{c?.companyName}</div>
                    <div className="truncate text-[12.5px] text-muted">{q.number} · {q.lines[0]?.description}</div>
                  </div>
                  <div className="hidden text-[13px] text-muted sm:block">geldig tot {formatDate(q.validUntil)}</div>
                  <div className="text-right">
                    <div className="tabular text-[14.5px] font-semibold">{formatEUR(total)}</div>
                    <div className="mt-1"><QuoteStatusBadge status={status} /></div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
