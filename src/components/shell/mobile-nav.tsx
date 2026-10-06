'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { LayoutGrid, FileText, ArrowLeftRight, Menu as MenuIcon, Plus, Camera, FileInput, FilePenLine, UserPlus, Upload } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { NAV, isActive } from './nav';
import { useAttention } from './use-attention';
import { useUI } from '@/lib/store/ui';
import { cn } from '@/lib/utils';

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [actions, setActions] = useState(false);
  const [more, setMore] = useState(false);
  const openScan = useUI((s) => s.openScan);
  const setUI = useUI((s) => s.set);
  const { counts } = useAttention();

  const tab = (href: string, label: string, Icon: React.ComponentType<{ className?: string }>, badge = 0) => {
    const active = isActive(pathname, href);
    return (
      <Link href={href} className="relative flex flex-1 flex-col items-center gap-1 pt-2.5 text-[10.5px] font-medium">
        <Icon className={cn('size-[22px] transition', active ? 'text-ink' : 'text-muted')} />
        <span className={active ? 'text-ink' : 'text-muted'}>{label}</span>
        {badge > 0 && <span className="absolute right-[calc(50%-18px)] top-1.5 size-2 rounded-full bg-danger-500 ring-2 ring-white" />}
      </Link>
    );
  };

  const action = (icon: React.ReactNode, title: string, sub: string, onClick: () => void, primary = false) => (
    <button
      onClick={() => { setActions(false); onClick(); }}
      className={cn('flex w-full items-center gap-4 rounded-[24px] p-4 text-left transition active:scale-[0.99]', primary ? 'bg-ink text-[#fafafa]' : 'bg-canvas')}
    >
      <div className={cn('grid size-11 place-items-center rounded-full [&_svg]:size-[20px]', primary ? 'bg-white/10' : 'bg-surface text-ink')}>{icon}</div>
      <div>
        <div className="text-[15px] font-semibold">{title}</div>
        <div className={cn('text-[12.5px]', primary ? 'text-white/75' : 'text-muted')}>{sub}</div>
      </div>
    </button>
  );

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/90 pb-safe backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex h-[62px] max-w-lg items-stretch px-2">
          {tab('/', 'Overzicht', LayoutGrid)}
          {tab('/facturen', 'Facturen', FileText, counts.overdue)}
          <div className="flex flex-1 items-start justify-center">
            <button
              onClick={() => setActions(true)}
              className="-mt-5 grid size-[56px] place-items-center rounded-full bg-ink text-[#fafafa] shadow-pop ring-4 ring-canvas transition active:scale-95"
              aria-label="Nieuw"
            >
              <Plus className="size-7" strokeWidth={2.4} />
            </button>
          </div>
          {tab('/bank', 'Bank', ArrowLeftRight, counts.bank)}
          <button onClick={() => setMore(true)} className="flex flex-1 flex-col items-center gap-1 pt-2.5 text-[10.5px] font-medium text-muted">
            <MenuIcon className="size-[22px]" />
            Meer
          </button>
        </div>
      </nav>

      <Dialog.Root open={actions} onOpenChange={setActions}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px]" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 rounded-t-[28px] bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-pop outline-none data-[state=open]:animate-[fade-in_0.25s_ease-out]">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line-strong" />
            <Dialog.Title className="px-1 pb-3 font-display text-[18px] font-semibold">Wat wil je doen?</Dialog.Title>
            <Dialog.Description className="sr-only">Snelle acties</Dialog.Description>
            <div className="space-y-2.5">
              {action(<Camera />, 'Bon scannen', 'Camera opent direct', () => openScan('receipt', true), true)}
              {action(<FileText />, 'Nieuwe factuur', 'Binnen een minuut verstuurd', () => router.push('/facturen/nieuw'))}
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  [<FileInput key="a" />, 'Inkoopfactuur', () => openScan('invoice')],
                  [<FilePenLine key="b" />, 'Offerte', () => router.push('/offertes/nieuw')],
                  [<Upload key="c" />, 'Bon uploaden', () => openScan('receipt')],
                  [<UserPlus key="d" />, 'Klant', () => setUI({ customerDrawer: { open: true } })],
                ].map(([icon, label, fn], i) => (
                  <button key={i} onClick={() => { setActions(false); (fn as () => void)(); }} className="flex items-center gap-3 rounded-[18px] bg-canvas p-3.5 text-left text-[14px] font-medium active:scale-[0.99] [&_svg]:size-5 [&_svg]:text-ink">
                    {icon as React.ReactNode}{label as string}
                  </button>
                ))}
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={more} onOpenChange={setMore}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px]" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-[28px] bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-pop outline-none">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-strong" />
            <Dialog.Title className="sr-only">Menu</Dialog.Title>
            <Dialog.Description className="sr-only">Alle onderdelen</Dialog.Description>
            {NAV.filter((g) => g.label).map((g) => (
              <div key={g.label} className="mb-3">
                <div className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-faint">{g.label}</div>
                <div className="grid grid-cols-3 gap-2">
                  {g.items.map((it) => (
                    <Link key={it.href} href={it.href} onClick={() => setMore(false)} className={cn('flex flex-col items-center gap-1.5 rounded-[18px] p-3 text-center text-[12.5px] font-medium', isActive(pathname, it.href) ? 'bg-ink text-[#fafafa]' : 'bg-canvas text-ink')}>
                      <it.icon className="size-5" />
                      {it.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
            <Link href="/instellingen" onClick={() => setMore(false)} className="mt-1 flex items-center justify-center rounded-full bg-canvas p-3 text-[14px] font-medium">Instellingen</Link>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
