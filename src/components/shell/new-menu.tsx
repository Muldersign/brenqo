'use client';

import { useRouter } from 'next/navigation';
import { Camera, FileInput, FilePenLine, FileText, Plus, UserPlus, Layers } from 'lucide-react';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/menu';
import { Button } from '@/components/ui/button';
import { useUI } from '@/lib/store/ui';

export function NewMenu({ className }: { className?: string }) {
  const router = useRouter();
  const openScan = useUI((s) => s.openScan);
  const setUI = useUI((s) => s.set);
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button className={className}>
          <Plus strokeWidth={2.5} /> Nieuw
        </Button>
      </MenuTrigger>
      <MenuContent className="w-[260px]">
        <MenuItem icon={<FileText />} onSelect={() => router.push('/facturen/nieuw')} hint="F">Nieuwe factuur</MenuItem>
        <MenuItem icon={<FilePenLine />} onSelect={() => router.push('/offertes/nieuw')}>Nieuwe offerte</MenuItem>
        <MenuItem icon={<Layers />} onSelect={() => router.push('/facturen/bulk')}>Meerdere facturen tegelijk</MenuItem>
        <MenuSeparator />
        <MenuItem icon={<Camera />} onSelect={() => openScan('receipt', true)} hint="B">Bon fotograferen</MenuItem>
        <MenuItem icon={<FileInput />} onSelect={() => openScan('invoice')}>Inkoopfactuur uploaden</MenuItem>
        <MenuSeparator />
        <MenuItem icon={<UserPlus />} onSelect={() => setUI({ customerDrawer: { open: true } })}>Nieuwe klant</MenuItem>
      </MenuContent>
    </Menu>
  );
}
