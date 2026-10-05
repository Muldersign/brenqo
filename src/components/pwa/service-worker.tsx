'use client';

import { useEffect } from 'react';

/** Registers /sw.js in production so Brenqo installs as an app and opens offline. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((e) => console.warn('Service worker niet geregistreerd', e));
  }, []);
  return null;
}
