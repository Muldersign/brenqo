'use client';

import { useState } from 'react';
import { Popover } from 'radix-ui';
import { Command } from 'cmdk';
import { ChevronsUpDown, Plus, Check } from 'lucide-react';
import { useCustomers } from '@/lib/store';
import { useUI } from '@/lib/store/ui';
import { Avatar } from '@/components/ui/misc';
import { cn } from '@/lib/utils';

export function CustomerPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const customers = useCustomers();
  const setUI = useUI((s) => s.set);
  const [open, setOpen] = useState(false);
  const selected = customers.find((c) => c.id === value);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(
            'flex w-full items-center gap-3 rounded-[14px] border bg-surface p-3 text-left shadow-card transition',
            open ? 'border-ink ring-1 ring-ink' : 'border-line-strong hover:border-faint',
          )}
        >
          {selected ? (
            <>
              <Avatar name={selected.companyName} size={40} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-semibold">{selected.companyName}</div>
                <div className="truncate text-[12.5px] text-muted">{[selected.contactName, selected.email, selected.city].filter(Boolean).join(' · ')}</div>
              </div>
            </>
          ) : (
            <>
              <div className="grid size-10 place-items-center rounded-[12px] border border-dashed border-line-strong text-faint"><Plus className="size-4" /></div>
              <div className="flex-1 text-[14.5px] text-muted">Kies een klant</div>
            </>
          )}
          <ChevronsUpDown className="size-4 text-faint" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={6} className="z-50 w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-[18px] border border-line bg-surface shadow-pop data-[state=open]:animate-[fade-in_0.15s_ease-out]">
          <Command>
            <Command.Input autoFocus placeholder="Zoek klant…" className="h-12 w-full border-b border-line bg-transparent px-4 text-[14.5px] outline-none placeholder:text-faint" />
            <Command.List className="max-h-[300px] overflow-y-auto p-1.5">
              <Command.Empty className="px-4 py-6 text-center text-[13.5px] text-muted">Geen klant gevonden</Command.Empty>
              {customers.map((c) => (
                <Command.Item
                  key={c.id}
                  value={`${c.companyName} ${c.contactName} ${c.city}`}
                  onSelect={() => { onChange(c.id); setOpen(false); }}
                  className="flex cursor-pointer items-center gap-3 rounded-[12px] px-2.5 py-2 data-[selected=true]:bg-black/[0.045]"
                >
                  <Avatar name={c.companyName} size={30} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-medium">{c.companyName}</div>
                    <div className="truncate text-[12px] text-muted">{c.city}{c.tags.length ? ` · ${c.tags.join(', ')}` : ''}</div>
                  </div>
                  {c.id === value && <Check className="size-4 text-brand-600" />}
                </Command.Item>
              ))}
            </Command.List>
          </Command>
          <button
            type="button"
            onClick={() => { setOpen(false); setUI({ customerDrawer: { open: true } }); }}
            className="flex w-full items-center gap-2 border-t border-line px-4 py-3 text-[13.5px] font-medium text-brand-600 hover:bg-brand-50/50"
          >
            <Plus className="size-4" /> Nieuwe klant toevoegen
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
