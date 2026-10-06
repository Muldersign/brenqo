'use client';

import Link from 'next/link';
import { Search } from 'lucide-react';
import { useUI } from '@/lib/store/ui';
import { NotificationsButton } from './notifications';
import { NewMenu } from './new-menu';
import { OrgLogo } from './org-switcher';
import { Kbd } from '@/components/ui/misc';
import { useOrg } from '@/lib/store';
import { OrgSwitcher } from './org-switcher';

export function Topbar() {
  const setSearchOpen = useUI((s) => s.setSearchOpen);
  const org = useOrg();
  return (
    <header className="sticky top-0 z-30 border-b border-transparent bg-canvas/80 pt-safe backdrop-blur-xl supports-[backdrop-filter]:bg-canvas/70">
      <div className="mx-auto flex h-16 max-w-[1320px] items-center gap-3 px-4 sm:px-6 lg:px-10">
        {/* Mobile: active administration */}
        <div className="-ml-2 min-w-0 flex-1 lg:hidden">
          <OrgSwitcher />
        </div>

        <button
          onClick={() => setSearchOpen(true)}
          className="group hidden h-9 w-full max-w-[420px] items-center gap-2.5 rounded-full bg-surface px-3.5 text-[14px] text-muted shadow-card transition hover:bg-subtle lg:flex"
        >
          <Search className="size-4 text-muted" />
          <span className="flex-1 text-left">Zoek klant, factuur, bedrag…</span>
          <span className="flex gap-1"><Kbd>⌘</Kbd><Kbd>K</Kbd></span>
        </button>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <button onClick={() => setSearchOpen(true)} className="grid size-9 place-items-center rounded-full text-ink hover:bg-surface lg:hidden" aria-label="Zoeken">
            <Search className="size-[19px]" />
          </button>
          <NotificationsButton />
          <NewMenu className="hidden sm:inline-flex" />
          <Link href="/instellingen" className="hidden lg:block" aria-label={`Instellingen ${org.name}`}>
            <OrgLogo size={34} className="rounded-full" />
          </Link>
        </div>
      </div>
    </header>
  );
}
