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
  paid: { icon: <CircleCheck />, cls: 'bg-canvas text-ink' },
  overdue: { icon: <CircleAlert />, cls: 'bg-danger-50 text-danger-600' },
  expense: { icon: <FileInput />, cls: 'bg-canvas text-ink' },
  receipt: { icon: <Receipt />, cls: 'bg-canvas text-ink' },
  bank: { icon: <ArrowLeftRight />, cls: 'bg-canvas text-ink' },
  quote: { icon: <FilePenLine />, cls: 'bg-canvas text-ink' },
  recurring: { icon: <Repeat />, cls: 'bg-canvas text-ink' },
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
        <button className="relative grid size-9 place-items-center rounded-full text-ink transition hover:bg-surface" aria-label="Meldingen">
          <Bell className="size-[19px]" />
          {unread > 0 && (
            <span className="tabular absolute right-1.5 top-1.5 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-danger-500 px-1 text-[10.5px] font-semibold text-white ring-2 ring-canvas">
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
          className="z-50 w-[min(400px,calc(100vw-24px))] overflow-hidden rounded-[24px] border border-line bg-surface shadow-pop data-[state=open]:animate-[fade-in_0.18s_ease-out]"
        >
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div>
              <div className="font-display text-[15px] font-semibold">Meldingen</div>
              <div className="text-[12.5px] text-muted">{unread ? `${unread} nieuw` : 'Je bent helemaal bij'}</div>
            </div>
            {unread > 0 && (
              <button onClick={() => markRead()} className="rounded-full bg-canvas px-3 py-1 text-[12.5px] font-medium text-ink hover:bg-[#ebebeb]">Alles gelezen</button>
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
                <div className={cn('flex gap-3 rounded-[18px] p-3 transition hover:bg-subtle', !n.read && 'bg-subtle')}>
                  <div className={cn('grid size-9 shrink-0 place-items-center rounded-full [&_svg]:size-[16px]', m.cls)}>{m.icon}</div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-medium leading-snug text-ink">{n.title}</div>
                    {n.body && <div className="mt-0.5 text-[12.5px] leading-snug text-muted">{n.body}</div>}
                    <div className="mt-1 text-[11.5px] text-faint">{relativeTime(n.createdAt)}</div>
                  </div>
                  {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-ink" />}
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
