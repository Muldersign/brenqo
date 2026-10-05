'use client';

import Link from 'next/link';
import { Popover } from 'radix-ui';
import { Bell, CircleCheck, CircleAlert, FileInput, Receipt, ArrowLeftRight, FilePenLine, Repeat, Info, BellOff } from 'lucide-react';
import { useNotifications, useStore } from '@/lib/store';
import { relativeTime } from '@/lib/domain/dates';
import { cn } from '@/lib/utils';
import type { NotificationKind } from '@/lib/types';
import { useMemo } from 'react';

const meta: Record<NotificationKind, { icon: React.ReactNode; cls: string }> = {
  paid: { icon: <CircleCheck />, cls: 'bg-success-50 text-success-600' },
  overdue: { icon: <CircleAlert />, cls: 'bg-danger-50 text-danger-600' },
  expense: { icon: <FileInput />, cls: 'bg-brand-50 text-brand-600' },
  receipt: { icon: <Receipt />, cls: 'bg-warning-50 text-warning-600' },
  bank: { icon: <ArrowLeftRight />, cls: 'bg-info-50 text-info-700' },
  quote: { icon: <FilePenLine />, cls: 'bg-brand-50 text-brand-600' },
  recurring: { icon: <Repeat />, cls: 'bg-brand-50 text-brand-600' },
  info: { icon: <Info />, cls: 'bg-subtle text-ink-2' },
};

export function NotificationsButton() {
  const items = useNotifications();
  const markRead = useStore((s) => s.markNotificationsRead);
  const sorted = useMemo(() => [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 30), [items]);
  const unread = items.filter((n) => !n.read).length;

  return (
    <Popover.Root onOpenChange={(open) => { if (!open && unread) markRead(); }}>
      <Popover.Trigger asChild>
        <button className="relative grid size-10 place-items-center rounded-[12px] text-ink-2 transition hover:bg-black/[0.04]" aria-label="Meldingen">
          <Bell className="size-[19px]" />
          {unread > 0 && (
            <span className="tabular absolute right-1.5 top-1.5 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-danger-500 px-1 text-[10.5px] font-bold text-white ring-2 ring-canvas">
              {unread}
            </span>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          collisionPadding={12}
          className="z-50 w-[min(400px,calc(100vw-24px))] overflow-hidden rounded-[20px] border border-line bg-surface shadow-pop data-[state=open]:animate-[fade-in_0.18s_ease-out]"
        >
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div>
              <div className="font-display text-[15px] font-semibold">Meldingen</div>
              <div className="text-[12.5px] text-muted">{unread ? `${unread} nieuw` : 'Je bent helemaal bij'}</div>
            </div>
            {unread > 0 && (
              <button onClick={() => markRead()} className="text-[12.5px] font-medium text-brand-600 hover:text-brand-700">Alles gelezen</button>
            )}
          </div>
          <div className="max-h-[440px] overflow-y-auto p-2">
            {sorted.length === 0 && (
              <div className="flex flex-col items-center px-6 py-12 text-center text-muted">
                <BellOff className="mb-3 size-6 text-faint" />
                <div className="text-[13.5px]">Nog geen meldingen</div>
              </div>
            )}
            {sorted.map((n) => {
              const m = meta[n.kind];
              const content = (
                <div className={cn('flex gap-3 rounded-[14px] p-3 transition hover:bg-subtle', !n.read && 'bg-brand-50/40')}>
                  <div className={cn('grid size-9 shrink-0 place-items-center rounded-[11px] [&_svg]:size-[17px]', m.cls)}>{m.icon}</div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-medium leading-snug text-ink">{n.title}</div>
                    {n.body && <div className="mt-0.5 text-[12.5px] leading-snug text-muted">{n.body}</div>}
                    <div className="mt-1 text-[11.5px] text-faint">{relativeTime(n.createdAt)}</div>
                  </div>
                  {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-500" />}
                </div>
              );
              return n.href ? (
                <Popover.Close asChild key={n.id}>
                  <Link href={n.href} className="block">{content}</Link>
                </Popover.Close>
              ) : (
                <div key={n.id}>{content}</div>
              );
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
