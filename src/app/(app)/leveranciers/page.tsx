'use client';

import { useMemo, useState } from 'react';
import { Truck, Brain, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useCategories, useExpenses, useStore, useSuppliers } from '@/lib/store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, EmptyState, PageHeader, SearchField } from '@/components/ui/misc';
import { Modal } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/input';
import { formatEUR } from '@/lib/domain/money';
import { formatDate } from '@/lib/domain/dates';
import { normalize } from '@/lib/utils';

export default function SuppliersPage() {
  const suppliers = useSuppliers();
  const expenses = useExpenses();
  const categories = useCategories();
  const save = useStore((s) => s.saveSupplier);
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState<{ name: string; category: string } | null>(null);

  const stats = useMemo(() => {
    const m = new Map<string, { total: number; last: string; count: number }>();
    for (const e of expenses) {
      const key = normalize(e.supplierName);
      const s = m.get(key) ?? { total: 0, last: '', count: 0 };
      s.total += e.total; s.count++; if (e.date > s.last) s.last = e.date;
      m.set(key, s);
    }
    return m;
  }, [expenses]);

  const visible = suppliers.filter((s) => !q || normalize(s.name).includes(normalize(q))).sort((a, b) => (stats.get(normalize(b.name))?.total ?? 0) - (stats.get(normalize(a.name))?.total ?? 0));

  return (
    <div className="animate-fade-in">
      <PageHeader title="Leveranciers" description="Brenqo onthoudt hoe je iedere leverancier boekt. Pas het hier aan, dan klopt het voortaan vanzelf." actions={<Button onClick={() => setAdding({ name: '', category: 'Overig' })}><Plus strokeWidth={2.5} /> Leverancier</Button>} />
      <SearchField value={q} onChange={setQ} placeholder="Zoek leverancier" className="mb-4 sm:w-[300px]" />
      {suppliers.length === 0 ? (
        <Card><EmptyState icon={<Truck />} title="Nog geen leveranciers" description="Zodra je een bon of inkoopfactuur verwerkt, verschijnt de leverancier hier vanzelf." /></Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden grid-cols-[minmax(180px,1.5fr)_220px_120px_140px] gap-4 border-b border-line bg-subtle/60 px-5 py-2.5 text-[12px] font-medium text-muted md:grid">
            <span>Leverancier</span><span>Wordt geboekt als</span><span>Laatst</span><span className="text-right">Totaal uitgegeven</span>
          </div>
          <ul>
            {visible.map((s) => {
              const st = stats.get(normalize(s.name));
              return (
                <li key={s.id} className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-line/70 px-5 py-3 last:border-0 md:grid-cols-[minmax(180px,1.5fr)_220px_120px_140px] md:gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={s.name} size={34} />
                    <div className="min-w-0">
                      <div className="truncate text-[14.5px] font-medium">{s.name}</div>
                      <div className="truncate text-[12px] text-muted">{st?.count ?? 0} documenten{s.website ? ` · ${s.website}` : ''}</div>
                    </div>
                  </div>
                  <div className="col-span-2 flex items-center gap-2 md:col-span-1">
                    <Brain className="size-3.5 shrink-0 text-brand-500" />
                    <Select value={s.defaultCategory} onChange={(e) => { save({ ...s, defaultCategory: e.target.value }); toast.success(`${s.name} wordt voortaan geboekt als ${e.target.value.toLowerCase()}`); }} className="flex-1">
                      {categories.map((c) => <option key={c.id}>{c.name}</option>)}
                    </Select>
                  </div>
                  <span className="hidden text-[13px] text-muted md:block">{st?.last ? formatDate(st.last) : '—'}</span>
                  <span className="tabular row-start-1 text-right text-[14px] font-semibold md:row-auto">{formatEUR(st?.total ?? 0)}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      <Modal open={!!adding} onOpenChange={(o) => !o && setAdding(null)} title="Leverancier toevoegen" size="sm" icon={<Truck />} footer={<>
        <Button variant="outline" onClick={() => setAdding(null)}>Annuleren</Button>
        <Button disabled={!adding?.name.trim()} onClick={() => { if (adding) save({ name: adding.name.trim(), defaultCategory: adding.category }); setAdding(null); toast.success('Leverancier toegevoegd'); }}>Toevoegen</Button>
      </>}>
        {adding && (
          <div className="space-y-4">
            <Field label="Naam"><Input value={adding.name} onChange={(e) => setAdding({ ...adding, name: e.target.value })} autoFocus /></Field>
            <Field label="Standaard categorie"><Select value={adding.category} onChange={(e) => setAdding({ ...adding, category: e.target.value })}>{categories.map((c) => <option key={c.id}>{c.name}</option>)}</Select></Field>
          </div>
        )}
      </Modal>
    </div>
  );
}
