'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PanelLeftClose, PanelLeft, Sparkles } from 'lucide-react';
import { NAV, isActive } from './nav';
import { OrgSwitcher } from './org-switcher';
import { useAttention } from './use-attention';
import { useUI } from '@/lib/store/ui';
import { useStore } from '@/lib/store';
import { Avatar, Tooltip } from '@/components/ui/misc';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const pathname = usePathname();
  const collapsed = useUI((s) => s.sidebarCollapsed);
  const toggle = useUI((s) => s.toggleSidebar);
  const { counts } = useAttention();
  const user = useStore((s) => s.user);

  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-[#fbfbfc] transition-[width] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] lg:flex',
        collapsed ? 'w-[76px]' : 'w-[264px]',
      )}
    >
      <div className={cn('flex items-center gap-2 px-4 pb-3 pt-5', collapsed && 'flex-col px-2')}>
        <Link href="/" className={cn('flex items-center gap-2', collapsed && 'mb-1')}>
          <BrandMark />
          {!collapsed && <span className="font-display text-[19px] font-bold tracking-[-0.03em]">brenqo</span>}
        </Link>
        <button
          onClick={toggle}
          className={cn('ml-auto grid size-8 place-items-center rounded-lg text-faint transition hover:bg-black/5 hover:text-ink-2', collapsed && 'ml-0')}
          aria-label={collapsed ? 'Menu uitklappen' : 'Menu inklappen'}
        >
          {collapsed ? <PanelLeft className="size-[18px]" /> : <PanelLeftClose className="size-[18px]" />}
        </button>
      </div>

      <div className={cn('px-3', collapsed && 'px-2')}>
        <div className="rounded-[16px] border border-line bg-surface shadow-card">
          <OrgSwitcher collapsed={collapsed} />
        </div>
      </div>

      <nav className="mt-4 flex-1 space-y-5 overflow-y-auto px-3 pb-6 scrollbar-none">
        {NAV.map((group, gi) => (
          <div key={gi}>
            {group.label && !collapsed && (
              <div className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">{group.label}</div>
            )}
            {group.label && collapsed && <div className="mx-auto mb-2 h-px w-6 bg-line" />}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                const count = item.badgeKey ? counts[item.badgeKey] : 0;
                const link = (
                  <Link
                    href={item.href}
                    className={cn(
                      'group relative flex h-9 items-center gap-3 rounded-[11px] px-3 text-[14px] font-medium transition-all',
                      active ? 'bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.04)]' : 'text-ink-2/80 hover:bg-black/[0.035] hover:text-ink',
                      collapsed && 'justify-center px-0',
                    )}
                  >
                    {active && <span className="absolute -left-3 top-1/2 h-4 w-1 -translate-y-1/2 rounded-r-full bg-brand-600" />}
                    <item.icon className={cn('size-[18px] shrink-0 transition', active ? 'text-brand-600' : 'text-muted group-hover:text-ink-2')} />
                    {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                    {count > 0 && !collapsed && (
                      <span className={cn('tabular min-w-5 rounded-full px-1.5 text-center text-[11px] font-semibold leading-5', item.badgeKey === 'overdue' ? 'bg-danger-50 text-danger-600' : 'bg-warning-50 text-warning-700')}>
                        {count}
                      </span>
                    )}
                    {count > 0 && collapsed && <span className={cn('absolute right-2 top-1.5 size-2 rounded-full ring-2 ring-[#fbfbfc]', item.badgeKey === 'overdue' ? 'bg-danger-500' : 'bg-warning-500')} />}
                  </Link>
                );
                return <li key={item.href}>{collapsed ? <Tooltip content={item.label} side="right">{link}</Tooltip> : link}</li>;
              })}
            </ul>
          </div>
        ))}
      </nav>

      {!collapsed && (
        <div className="mx-3 mb-3 rounded-[16px] border border-line bg-gradient-to-br from-brand-50 via-surface to-surface p-3.5">
          <div className="flex items-center gap-2 text-[12.5px] font-semibold text-brand-700">
            <Sparkles className="size-3.5" /> Tip
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">
            Installeer Brenqo op je telefoon en scan bonnetjes direct met je camera.
          </p>
        </div>
      )}

      <div className={cn('flex items-center gap-3 border-t border-line px-4 py-3.5', collapsed && 'justify-center px-2')}>
        <Avatar name={user.name} size={32} />
        {!collapsed && (
          <div className="min-w-0">
            <div className="truncate text-[13.5px] font-medium">{user.name}</div>
            <div className="truncate text-[12px] text-muted">{user.email}</div>
          </div>
        )}
      </div>
    </aside>
  );
}

export function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <defs>
        <linearGradient id="bq-g" x1="0" y1="0" x2="32" y2="32">
          <stop offset="0" stopColor="#8c7ff8" />
          <stop offset="1" stopColor="#4936d6" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#bq-g)" />
      <path d="M11 8.5h6.2c3 0 4.9 1.6 4.9 4 0 1.6-.9 2.8-2.2 3.3 1.8.4 3 1.8 3 3.7 0 2.7-2.1 4.5-5.4 4.5H11V8.5Z" fill="#fff" fillOpacity=".95" />
      <circle cx="16.4" cy="19.4" r="2.1" fill="#4936d6" />
    </svg>
  );
}
