'use client';

import { create } from 'zustand';

/** Global UI state: which modal/drawer is open. Kept out of the data store on purpose. */
interface UIState {
  sidebarCollapsed: boolean;
  searchOpen: boolean;
  scan: { open: boolean; kind: 'receipt' | 'invoice'; capture: boolean };
  sendInvoiceId: string | null;
  sendQuoteId: string | null;
  markPaidId: string | null;
  reminderId: string | null;
  customerDrawer: { open: boolean; id?: string };
  toggleSidebar: () => void;
  setSearchOpen: (open: boolean) => void;
  openScan: (kind?: 'receipt' | 'invoice', capture?: boolean) => void;
  closeScan: () => void;
  set: (patch: Partial<UIState>) => void;
}

export const useUI = create<UIState>((set) => ({
  sidebarCollapsed: false,
  searchOpen: false,
  scan: { open: false, kind: 'receipt', capture: false },
  sendInvoiceId: null,
  sendQuoteId: null,
  markPaidId: null,
  reminderId: null,
  customerDrawer: { open: false },
  toggleSidebar: () => set((s) => {
    const next = !s.sidebarCollapsed;
    try { localStorage.setItem('brenqo-sidebar', next ? '1' : '0'); } catch { /* ignore */ }
    return { sidebarCollapsed: next };
  }),
  setSearchOpen: (open) => set({ searchOpen: open }),
  openScan: (kind = 'receipt', capture = false) => set({ scan: { open: true, kind, capture } }),
  closeScan: () => set((s) => ({ scan: { ...s.scan, open: false } })),
  set: (patch) => set(patch),
}));
