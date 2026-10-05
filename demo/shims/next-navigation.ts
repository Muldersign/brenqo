import { useMemo } from 'react';
import { back, navigate, useLocationHref, useParamsInternal } from './router';

export function useRouter() {
  return {
    push: (href: string, opts?: { scroll?: boolean }) => navigate(href, opts),
    replace: (href: string, opts?: { scroll?: boolean }) => navigate(href, { ...opts, replace: true }),
    back,
    forward: () => {},
    refresh: () => {},
    prefetch: () => {},
  };
}

export function usePathname() {
  return useLocationHref().split('?')[0];
}

export function useSearchParams() {
  const href = useLocationHref();
  return useMemo(() => new URLSearchParams(href.split('?')[1] ?? ''), [href]);
}

export function useParams<T extends Record<string, string>>() {
  return useParamsInternal() as T;
}
