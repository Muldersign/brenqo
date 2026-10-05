/**
 * In-memory router for the standalone demo build. Replaces next/link and
 * next/navigation so the whole app runs as one self-contained page
 * (e.g. hosted as a claude.ai Artifact) without a server.
 */
import { createContext, useContext, useSyncExternalStore } from 'react';

type Listener = () => void;
let current = '/';
const listeners = new Set<Listener>();
const history: string[] = [];

export function navigate(href: string, opts: { replace?: boolean; scroll?: boolean } = {}) {
  if (!href.startsWith('/')) return;
  if (!opts.replace) history.push(current);
  current = href;
  listeners.forEach((l) => l());
  if (opts.scroll !== false) window.scrollTo({ top: 0 });
}

export function back() {
  const prev = history.pop();
  if (prev) navigate(prev, { replace: true });
}

const subscribe = (l: Listener) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useLocationHref() {
  return useSyncExternalStore(subscribe, () => current, () => current);
}

export const ParamsContext = createContext<Record<string, string>>({});

export function matchRoute(pattern: string, pathname: string): Record<string, string> | null {
  const p = pattern.split('/').filter(Boolean);
  const a = pathname.split('/').filter(Boolean);
  if (p.length !== a.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(a[i]);
    else if (p[i] !== a[i]) return null;
  }
  return params;
}

export function useParamsInternal() {
  return useContext(ParamsContext);
}
