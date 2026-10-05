'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { MobileNav } from './mobile-nav';
import { CommandSearch } from './command-search';
import { useStore } from '@/lib/store';
import { useUI } from '@/lib/store/ui';
import { todayISO } from '@/lib/domain/dates';
import { ScanFlow } from '@/components/flows/scan-flow';
import { SendInvoiceModal } from '@/components/flows/send-invoice';
import { MarkPaidModal } from '@/components/flows/mark-paid';
import { CustomerDrawer } from '@/components/flows/customer-drawer';
import { ReminderModal } from '@/components/flows/reminder';
import { SendQuoteModal } from '@/components/flows/send-quote';
import { Skeleton } from '@/components/ui/misc';

export function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (localStorage.getItem('brenqo-sidebar') === '1') useUI.setState({ sidebarCollapsed: true });
    } catch { /* ignore */ }
    // First visit: write the demo administration to storage so links stay stable.
    try {
      if (!localStorage.getItem('brenqo-data')) useStore.setState({});
    } catch { /* ignore */ }
    const s = useStore.getState();
    if (s.automationsRanOn !== todayISO()) {
      const r = s.runAutomations();
      const parts = [
        r.recurring && `${r.recurring} periodieke ${r.recurring === 1 ? 'factuur' : 'facturen'} gemaakt`,
        r.reminders && `${r.reminders} ${r.reminders === 1 ? 'herinnering' : 'herinneringen'} verstuurd`,
        r.matched && `${r.matched} ${r.matched === 1 ? 'betaling' : 'betalingen'} gekoppeld`,
      ].filter(Boolean);
      if (parts.length) toast('Brenqo heeft vandaag al wat werk gedaan', { description: parts.join(' · ') });
    }
  }, [hydrated]);

  if (!hydrated) return <ShellSkeleton />;

  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="mx-auto w-full max-w-[1320px] flex-1 px-4 pb-32 pt-4 sm:px-6 sm:pt-6 lg:px-10 lg:pb-16">{children}</main>
      </div>
      <MobileNav />
      <CommandSearch />
      <ScanFlow />
      <SendInvoiceModal />
      <SendQuoteModal />
      <MarkPaidModal />
      <ReminderModal />
      <CustomerDrawer />
    </div>
  );
}

function ShellSkeleton() {
  return (
    <div className="flex min-h-dvh">
      <div className="hidden w-[264px] shrink-0 border-r border-line bg-[#fbfbfc] p-4 lg:block">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="mt-5 h-14 w-full rounded-2xl" />
        <div className="mt-6 space-y-2.5">{Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
      </div>
      <div className="flex-1 px-4 pt-20 sm:px-10">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="mt-3 h-5 w-80" />
        <div className="mt-8 grid grid-cols-2 gap-4 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-[18px]" />)}</div>
        <Skeleton className="mt-6 h-80 w-full rounded-[18px]" />
      </div>
    </div>
  );
}
