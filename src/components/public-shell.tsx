'use client';

import { useEffect } from 'react';
import { ShieldCheck, Lock } from 'lucide-react';
import { useStore } from '@/lib/store';
import { backendEnabled } from '@/lib/backend/config';
import { useHydrated } from '@/components/shell/app-shell';
import { Skeleton } from '@/components/ui/misc';
import { BrandMark } from '@/components/shell/sidebar';

/** Minimal, trustworthy frame for pages customers see. */
export function PublicShell({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  useEffect(() => {
    if (backendEnabled) return;
    try { if (!localStorage.getItem('brenqo-data')) useStore.setState({}); } catch { /* ignore */ }
  }, []);
  return (
    <div className="min-h-dvh bg-canvas px-4 pb-16 pt-[max(2rem,env(safe-area-inset-top))]">
      <div className="mx-auto max-w-[620px]">
        {hydrated ? children : (
          <div className="space-y-4 pt-10">
            <Skeleton className="mx-auto h-14 w-14 rounded-2xl" />
            <Skeleton className="mx-auto h-6 w-48" />
            <Skeleton className="h-72 w-full rounded-[24px]" />
          </div>
        )}
        <footer className="mt-10 flex flex-col items-center gap-2 text-center text-[12px] text-faint">
          <div className="flex items-center gap-1.5"><Lock className="size-3" /> Beveiligde verbinding · <ShieldCheck className="size-3" /> Persoonlijke link</div>
          <div className="flex items-center gap-1.5">Verstuurd met <BrandMark size={14} /> <span className="font-semibold text-muted">brenqo</span></div>
        </footer>
      </div>
    </div>
  );
}
