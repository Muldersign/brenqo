'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Users, UserPlus, MapPin } from 'lucide-react';
import { useCustomers, useInvoiceRows, useOrg } from '@/lib/store';
import { useUI } from '@/lib/store/ui';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, EmptyState, PageHeader, SearchField, Segmented } from '@/components/ui/misc';
import { formatEUR } from '@/lib/domain/money';
import { normalize } from '@/lib/utils';
import { isOutstanding } from '@/lib/domain/status';

export default function CustomersPage() {
  const customers = useCustomers();
  const rows = useInvoiceRows();
  const org = useOrg();
  const setUI = useUI((s) => s.set);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'name' | 'revenue' | 'open'>('revenue');
  const [tag, setTag] = useState('all');
  const tags = useMemo(() => [...new Set(customers.flatMap((c) => c.tags))], [customers]);

  const stats = useMemo(() => {
    const m = new Map<string, { revenue: number; open: number; overdue: boolean; count: number }>();
    for (const r of rows) {
      if (r.status === 'draft') continue;
      const s = m.get(r.inv.customerId) ?? { revenue: 0, open: 0, overdue: false, count: 0 };
      if (r.status !== 'credited') s.revenue += r.total;
      if (isOutstanding(r.status)) s.open += r.due;
      if (r.status === 'overdue') s.overdue = true;
      s.count++;
      m.set(r.inv.customerId, s);
    }
    return m;
  }, [rows]);

  const visible = customers
    .filter((c) => (tag === 'all' || c.tags.includes(tag)) && (!q || normalize(`${c.companyName} ${c.contactName} ${c.city} ${c.email}`).includes(normalize(q))))
    .sort((a, b) => sort === 'name' ? a.companyName.localeCompare(b.companyName) : sort === 'open' ? (stats.get(b.id)?.open ?? 0) - (stats.get(a.id)?.open ?? 0) : (stats.get(b.id)?.revenue ?? 0) - (stats.get(a.id)?.revenue ?? 0));

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={org.kind === 'association' ? 'Leden & relaties' : 'Klanten'}
        description={`${customers.length} ${org.kind === 'association' ? 'relaties' : 'klanten'} in ${org.name}`}
        actions={<Button onClick={() => setUI({ customerDrawer: { open: true } })}><UserPlus /> Nieuwe {org.kind === 'association' ? 'relatie' : 'klant'}</Button>}
      />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Segmented value={sort} onChange={setSort} options={[{ value: 'revenue', label: 'Meeste omzet' }, { value: 'open', label: 'Openstaand' }, { value: 'name', label: 'A–Z' }]} />
          {tags.length > 0 && <Segmented value={tag} onChange={setTag} options={[{ value: 'all', label: 'Alle' }, ...tags.map((t) => ({ value: t, label: t }))]} />}
        </div>
        <SearchField value={q} onChange={setQ} placeholder="Zoek op naam, plaats of e-mail" className="sm:w-[300px]" />
      </div>
      {customers.length === 0 ? (
        <Card><EmptyState icon={<Users />} title="Nog geen klanten" description="Voeg je eerste klant toe. Alleen een naam is genoeg om te beginnen." action={<Button onClick={() => setUI({ customerDrawer: { open: true } })}><UserPlus /> Klant toevoegen</Button>} /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((c) => {
            const s = stats.get(c.id);
            return (
              <Link key={c.id} href={`/klanten/${c.id}`}>
                <Card className="group h-full p-5 transition-all hover:-translate-y-0.5 hover:shadow-raised">
                  <div className="flex items-center gap-3.5">
                    <Avatar name={c.companyName} size={44} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[15px] font-semibold">{c.companyName}</div>
                      <div className="flex items-center gap-1 truncate text-[12.5px] text-muted">{c.city && <><MapPin className="size-3" />{c.city}</>}{c.tags.length > 0 && <span className="ml-1">· {c.tags.join(', ')}</span>}</div>
                    </div>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4">
                    <div>
                      <div className="text-[12px] text-muted">Totale omzet</div>
                      <div className="tabular mt-0.5 text-[15px] font-semibold">{formatEUR(s?.revenue ?? 0, { round: true })}</div>
                    </div>
                    <div>
                      <div className="text-[12px] text-muted">Openstaand</div>
                      <div className={`tabular mt-0.5 text-[15px] font-semibold ${s?.overdue ? 'text-danger-600' : s?.open ? 'text-ink' : 'text-faint'}`}>{formatEUR(s?.open ?? 0, { round: true })}</div>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
