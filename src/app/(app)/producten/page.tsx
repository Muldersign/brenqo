'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Package, Plus, Pencil, Trash, FilePlus } from 'lucide-react';
import { toast } from 'sonner';
import { useOrg, useProducts, useStore } from '@/lib/store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState, PageHeader, SearchField, IconTile } from '@/components/ui/misc';
import { Modal } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu';
import { formatEUR, parseAmount } from '@/lib/domain/money';
import type { Product, VatRate } from '@/lib/types';
import { normalize } from '@/lib/utils';

type Form = { id?: string; name: string; description: string; price: string; vatRate: VatRate; unit: string };

export default function ProductsPage() {
  const products = useProducts();
  const org = useOrg();
  const save = useStore((s) => s.saveProduct);
  const remove = useStore((s) => s.deleteProduct);
  const [form, setForm] = useState<Form | null>(null);
  const [q, setQ] = useState('');
  const visible = products.filter((p) => !q || normalize(p.name + p.description).includes(normalize(q)));
  const open = (p?: Product) => setForm(p ? { id: p.id, name: p.name, description: p.description, price: String(p.price).replace('.', ','), vatRate: p.vatRate, unit: p.unit } : { name: '', description: '', price: '', vatRate: org.defaultVatRate, unit: 'uur' });

  return (
    <div className="animate-fade-in">
      <PageHeader title="Producten & diensten" description="Wat je vaak factureert. Bij het maken van een factuur kies je ze met één klik." actions={<Button onClick={() => open()}><Plus strokeWidth={2.5} /> Nieuw product</Button>} />
      {products.length > 3 && <SearchField value={q} onChange={setQ} placeholder="Zoek product" className="mb-4 sm:w-[300px]" />}
      {products.length === 0 ? (
        <Card><EmptyState icon={<Package />} title="Nog geen producten" description="Voeg bijvoorbeeld je uurtarief of een vast pakket toe. Dat scheelt typwerk." action={<Button onClick={() => open()}><Plus /> Eerste product</Button>} /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((p) => (
            <Card key={p.id} className="group flex items-start gap-4 p-5 transition hover:shadow-raised">
              <IconTile tone="brand"><Package /></IconTile>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold">{p.name}</div>
                <div className="mt-0.5 line-clamp-2 text-[13px] text-muted">{p.description}</div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="tabular font-display text-[20px] font-semibold">{formatEUR(p.price)}</span>
                  <span className="text-[13px] text-muted">per {p.unit}{org.vatRegistered ? ` · ${p.vatRate}% btw` : ''}</span>
                </div>
              </div>
              <Menu>
                <MenuTrigger asChild><button className="grid size-8 place-items-center rounded-lg text-muted hover:bg-black/5" aria-label="Acties">⋯</button></MenuTrigger>
                <MenuContent>
                  <MenuItem icon={<FilePlus />} asChild><Link href={`/facturen/nieuw?product=${p.id}`}>Factureren</Link></MenuItem>
                  <MenuItem icon={<Pencil />} onSelect={() => open(p)}>Bewerken</MenuItem>
                  <MenuItem icon={<Trash />} danger onSelect={() => { remove(p.id); toast.success('Product verwijderd'); }}>Verwijderen</MenuItem>
                </MenuContent>
              </Menu>
            </Card>
          ))}
        </div>
      )}
      <Modal
        open={!!form}
        onOpenChange={(o) => !o && setForm(null)}
        title={form?.id ? 'Product bewerken' : 'Nieuw product'}
        icon={<Package />}
        size="sm"
        footer={<>
          <Button variant="outline" onClick={() => setForm(null)}>Annuleren</Button>
          <Button disabled={!form?.name.trim()} onClick={() => { if (!form) return; save({ id: form.id, name: form.name, description: form.description, price: parseAmount(form.price), vatRate: form.vatRate, unit: form.unit }); setForm(null); toast.success('Product opgeslagen'); }}>Opslaan</Button>
        </>}
      >
        {form && (
          <div className="space-y-4">
            <Field label="Naam"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Website onderhoud" autoFocus /></Field>
            <Field label="Omschrijving" optional><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="min-h-[70px]" /></Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Prijs" className="col-span-1"><Input prefix="€" inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></Field>
              <Field label="Eenheid"><Select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>{['uur', 'stuk', 'dag', 'maand', 'jaar', 'seizoen', 'project'].map((u) => <option key={u}>{u}</option>)}</Select></Field>
              <Field label="Btw"><Select value={form.vatRate} onChange={(e) => setForm({ ...form, vatRate: Number(e.target.value) as VatRate })}><option value={21}>21%</option><option value={9}>9%</option><option value={0}>0%</option></Select></Field>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
