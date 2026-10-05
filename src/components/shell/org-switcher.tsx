'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useOrg, useStore } from '@/lib/store';
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { Modal } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export function OrgLogo({ size = 32, className }: { size?: number; className?: string }) {
  const org = useOrg();
  return <OrgMark org={org} size={size} className={className} />;
}

export function OrgMark({ org, size = 32, className }: { org: { initials: string; accentColor: string; logoDataUrl?: string; name: string }; size?: number; className?: string }) {
  if (org.logoDataUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={org.logoDataUrl} alt={org.name} className={cn('shrink-0 rounded-[10px] bg-white object-contain ring-1 ring-line', className)} style={{ width: size, height: size }} />;
  }
  return (
    <div
      className={cn('grid shrink-0 place-items-center rounded-[10px] font-display font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]', className)}
      style={{ width: size, height: size, fontSize: size * 0.38, background: `linear-gradient(140deg, ${org.accentColor}, color-mix(in srgb, ${org.accentColor} 70%, #000))` }}
    >
      {org.initials}
    </div>
  );
}

export function OrgSwitcher({ collapsed }: { collapsed?: boolean }) {
  const org = useOrg();
  const orgs = useStore((s) => s.organizations);
  const setActiveOrg = useStore((s) => s.setActiveOrg);
  const createOrganization = useStore((s) => s.createOrganization);
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'business' | 'association'>('business');

  return (
    <>
      <Menu>
        <MenuTrigger asChild>
          <button
            className={cn(
              'group flex w-full items-center gap-3 rounded-[14px] p-2 text-left transition hover:bg-black/[0.035]',
              collapsed && 'justify-center p-1.5',
            )}
          >
            <OrgMark org={org} size={collapsed ? 34 : 36} />
            {!collapsed && (
              <>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-faint">Administratie</div>
                  <div className="truncate font-display text-[14.5px] font-semibold text-ink">{org.name}</div>
                </div>
                <ChevronsUpDown className="size-4 text-faint transition group-hover:text-muted" />
              </>
            )}
          </button>
        </MenuTrigger>
        <MenuContent align="start" className="w-[260px]">
          <MenuLabel>Wissel van administratie</MenuLabel>
          {orgs.map((o) => (
            <MenuItem
              key={o.id}
              onSelect={() => {
                if (o.id === org.id) return;
                setActiveOrg(o.id);
                router.push('/');
                toast(`Je werkt nu in ${o.name}`);
              }}
              className="h-11"
              icon={<OrgMark org={o} size={26} />}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-medium text-ink">{o.name}</div>
                  <div className="text-[11.5px] text-muted">{o.kind === 'association' ? 'Vereniging' : 'Onderneming'}</div>
                </div>
                {o.id === org.id && <Check className="!size-4 !text-brand-600" />}
              </div>
            </MenuItem>
          ))}
          <MenuSeparator />
          <MenuItem icon={<Plus />} onSelect={() => setCreating(true)}>Nieuwe administratie</MenuItem>
        </MenuContent>
      </Menu>

      <Modal
        open={creating}
        onOpenChange={setCreating}
        title="Nieuwe administratie"
        description="Iedere administratie heeft eigen klanten, facturen, bank en instellingen. Alles blijft volledig gescheiden."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreating(false)}>Annuleren</Button>
            <Button
              disabled={!name.trim()}
              onClick={() => {
                createOrganization({ name: name.trim(), kind });
                setCreating(false);
                setName('');
                router.push('/instellingen');
                toast.success('Administratie aangemaakt', { description: 'Vul je bedrijfsgegevens in, dan kun je direct factureren.' });
              }}
            >
              Aanmaken
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <TextField label="Naam" value={name} onChange={(e) => setName(e.target.value)} placeholder="Bijvoorbeeld: Muldersign" autoFocus />
          <div className="grid grid-cols-2 gap-2">
            {([['business', 'Onderneming', 'ZZP, eenmanszaak of bv'], ['association', 'Vereniging', 'Club, stichting of organisatie']] as const).map(([v, t, d]) => (
              <button
                key={v}
                type="button"
                onClick={() => setKind(v)}
                className={cn('rounded-2xl border p-3.5 text-left transition', kind === v ? 'border-brand-400 bg-brand-50/60 ring-4 ring-brand-100' : 'border-line-strong hover:bg-subtle')}
              >
                <div className="text-[14px] font-semibold">{t}</div>
                <div className="mt-0.5 text-[12.5px] text-muted">{d}</div>
              </button>
            ))}
          </div>
        </div>
      </Modal>
    </>
  );
}
