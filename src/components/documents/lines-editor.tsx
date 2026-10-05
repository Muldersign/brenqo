'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Plus, Trash, Package, Percent, GripVertical } from 'lucide-react';
import { useOrg, useProducts } from '@/lib/store';
import type { DocumentLine, Product, VatRate } from '@/lib/types';
import { lineNet } from '@/lib/domain/calc';
import { formatEUR, parseAmount } from '@/lib/domain/money';
import { Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger } from '@/components/ui/menu';
import { Button } from '@/components/ui/button';
import { uid, cn } from '@/lib/utils';

const UNITS = ['stuk', 'uur', 'dag', 'maand', 'jaar', 'seizoen', 'km', 'project'];

export function newLine(vatRate: VatRate, p?: Product): DocumentLine {
  return {
    id: uid('ln'), description: p?.name ?? '', quantity: 1, unit: p?.unit ?? 'stuk', unitPrice: p?.price ?? 0,
    vatRate: p?.vatRate ?? vatRate, discountPct: 0, productId: p?.id,
  };
}

/** Number input that keeps what you type ("1,5") and parses on blur. */
function NumberInput({ value, onChange, className, prefix, ariaLabel }: { value: number; onChange: (n: number) => void; className?: string; prefix?: string; ariaLabel: string }) {
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? (value === 0 && prefix ? '' : String(value).replace('.', ','));
  return (
    <div className={cn('relative', className)}>
      {prefix && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted">{prefix}</span>}
      <input
        aria-label={ariaLabel}
        inputMode="decimal"
        value={shown}
        placeholder={prefix ? '0,00' : '0'}
        onFocus={(e) => e.target.select()}
        onChange={(e) => { setText(e.target.value); onChange(parseAmount(e.target.value)); }}
        onBlur={() => setText(null)}
        className={cn('tabular h-10 w-full rounded-[11px] border border-line-strong bg-surface px-3 text-right outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100', prefix && 'pl-7')}
      />
    </div>
  );
}

export function LinesEditor({ lines, onChange, showVat = true }: { lines: DocumentLine[]; onChange: (l: DocumentLine[]) => void; showVat?: boolean }) {
  const products = useProducts();
  const org = useOrg();
  const [suggestFor, setSuggestFor] = useState<string | null>(null);
  const update = (id: string, patch: Partial<DocumentLine>) => onChange(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const remove = (id: string) => onChange(lines.filter((l) => l.id !== id));

  return (
    <div className="@container">
      <div className="hidden grid-cols-[1fr_84px_96px_118px_84px_104px_32px] gap-2 px-1 pb-2 text-[12px] font-medium text-muted @3xl:grid">
        <span className="pl-6">Omschrijving</span><span className="text-right">Aantal</span><span>Eenheid</span><span className="text-right">Prijs</span><span>{showVat ? 'Btw' : ''}</span><span className="text-right">Bedrag</span><span />
      </div>
      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {lines.map((l) => {
            const matches = suggestFor === l.id && l.description.length > 0
              ? products.filter((p) => p.name.toLowerCase().includes(l.description.toLowerCase()) && p.name !== l.description).slice(0, 4)
              : [];
            return (
              <motion.li
                key={l.id}
                layout
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                className="group relative rounded-[14px] border border-line bg-subtle/50 p-2.5 @3xl:border-0 @3xl:bg-transparent @3xl:p-0"
              >
                <div className="grid grid-cols-2 gap-2 @3xl:grid-cols-[1fr_84px_96px_118px_84px_104px_32px] @3xl:items-center">
                  <div className="relative col-span-2 flex items-center gap-1 pr-9 @3xl:col-span-1 @3xl:pr-0">
                    <GripVertical className="hidden size-4 shrink-0 text-faint opacity-0 transition group-hover:opacity-100 @3xl:block" />
                    <input
                      value={l.description}
                      onChange={(e) => { update(l.id, { description: e.target.value }); setSuggestFor(l.id); }}
                      onBlur={() => setTimeout(() => setSuggestFor(null), 150)}
                      placeholder="Wat heb je geleverd?"
                      className="h-10 w-full rounded-[11px] border border-line-strong bg-surface px-3 outline-none transition placeholder:text-faint focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
                    />
                    {matches.length > 0 && (
                      <div className="absolute left-0 right-0 top-11 z-20 overflow-hidden rounded-[14px] border border-line bg-surface p-1 shadow-pop @3xl:left-5">
                        {matches.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => { update(l.id, { description: p.name, unitPrice: p.price, unit: p.unit, vatRate: p.vatRate, productId: p.id }); setSuggestFor(null); }}
                            className="flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-left text-[13.5px] hover:bg-subtle"
                          >
                            <span className="flex items-center gap-2"><Package className="size-3.5 text-muted" />{p.name}</span>
                            <span className="tabular text-muted">{formatEUR(p.price)} / {p.unit}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <NumberInput ariaLabel="Aantal" value={l.quantity} onChange={(n) => update(l.id, { quantity: n })} />
                  <select value={l.unit} onChange={(e) => update(l.id, { unit: e.target.value })} className="h-10 rounded-[11px] border border-line-strong bg-surface px-2.5 outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-100" aria-label="Eenheid">
                    {[...new Set([l.unit, ...UNITS])].map((u) => <option key={u}>{u}</option>)}
                  </select>
                  <NumberInput ariaLabel="Prijs" prefix="€" value={l.unitPrice} onChange={(n) => update(l.id, { unitPrice: n })} />
                  {showVat ? (
                    <select value={l.vatRate} onChange={(e) => update(l.id, { vatRate: Number(e.target.value) as VatRate })} className="h-10 rounded-[11px] border border-line-strong bg-surface px-2.5 outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-100" aria-label="Btw">
                      <option value={21}>21%</option><option value={9}>9%</option><option value={0}>0%</option>
                    </select>
                  ) : <span className="hidden @3xl:block" />}
                  <div className="col-span-2 flex items-center justify-between @3xl:col-span-1 @3xl:block @3xl:text-right">
                    <span className="text-[12.5px] text-muted @3xl:hidden">Bedrag</span>
                    <span className="tabular text-[14px] font-semibold">{formatEUR(lineNet(l))}</span>
                    {l.discountPct > 0 && <span className="block text-[11.5px] text-success-600">−{l.discountPct}% korting</span>}
                  </div>
                  <div className="absolute right-2 top-2 flex gap-0.5 @3xl:static">
                    <Menu>
                      <MenuTrigger asChild>
                        <button type="button" className="grid size-8 place-items-center rounded-lg text-faint transition hover:bg-black/5 hover:text-ink @3xl:opacity-0 @3xl:group-hover:opacity-100 data-[state=open]:opacity-100" aria-label="Regelopties">
                          <Percent className="size-4" />
                        </button>
                      </MenuTrigger>
                      <MenuContent>
                        <MenuLabel>Korting op deze regel</MenuLabel>
                        {[0, 5, 10, 15, 20, 25, 50].map((d) => (
                          <MenuItem key={d} onSelect={() => update(l.id, { discountPct: d })}>{d === 0 ? 'Geen korting' : `${d}%`}</MenuItem>
                        ))}
                        <MenuItem icon={<Trash />} danger onSelect={() => remove(l.id)}>Regel verwijderen</MenuItem>
                      </MenuContent>
                    </Menu>
                  </div>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="soft" size="sm" onClick={() => onChange([...lines, newLine(org.defaultVatRate)])}><Plus /> Regel toevoegen</Button>
        {products.length > 0 && (
          <Menu>
            <MenuTrigger asChild><Button type="button" variant="ghost" size="sm"><Package /> Uit producten</Button></MenuTrigger>
            <MenuContent align="start" className="w-[300px]">
              <MenuLabel>Producten & diensten</MenuLabel>
              {products.map((p) => (
                <MenuItem key={p.id} onSelect={() => {
                  const empty = lines.length === 1 && !lines[0].description && !lines[0].unitPrice;
                  onChange(empty ? [newLine(org.defaultVatRate, p)] : [...lines, newLine(org.defaultVatRate, p)]);
                }} hint={`${formatEUR(p.price)}/${p.unit}`}>{p.name}</MenuItem>
              ))}
            </MenuContent>
          </Menu>
        )}
      </div>
    </div>
  );
}
