'use client';

import { useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';
import { toast } from 'sonner';
import { SwitchRow } from '@/components/ui/switch';
import { backendEnabled } from '@/lib/backend/config';
import { authedFetch } from '@/lib/backend/client';

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

function keyToBytes(base64: string) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** "Meldingen op dit apparaat": web push for payments, new purchase invoices and the daily summary. */
export function PushToggle() {
  const [on, setOn] = useState(false);
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    const ok = backendEnabled && !!VAPID && 'serviceWorker' in navigator && 'PushManager' in window;
    setSupported(ok);
    if (ok) navigator.serviceWorker.ready.then((r) => r.pushManager.getSubscription()).then((s) => setOn(!!s)).catch(() => {});
  }, []);
  if (!supported) return null;

  async function toggle(v: boolean) {
    const reg = await navigator.serviceWorker.ready;
    if (v) {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { toast('Meldingen zijn geblokkeerd in je browserinstellingen'); return; }
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(VAPID) });
      const res = await authedFetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sub.toJSON()) });
      if (!res.ok) { toast.error('Aanzetten lukte niet'); return; }
      setOn(true);
      toast.success('Meldingen staan aan op dit apparaat');
    } else {
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await authedFetch('/api/push/subscribe', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setOn(false);
    }
  }

  return <SwitchRow icon={<BellRing />} title="Meldingen op dit apparaat" description="Krijg een melding als een factuur betaald is of er een inkoopfactuur binnenkomt. Werkt ook op iPhone als Brenqo op je beginscherm staat." checked={on} onCheckedChange={(v) => { toggle(v).catch(() => toast.error('Aanzetten lukte niet')); }} />;
}
