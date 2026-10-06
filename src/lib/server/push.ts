import 'server-only';
import webpush from 'web-push';
import { adminClient } from './supabase';

let configured = false;

export function pushConfigured() {
  return !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function setup() {
  if (configured) return;
  webpush.setVapidDetails(`mailto:${process.env.VAPID_CONTACT ?? 'support@brenqo.nl'}`, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  configured = true;
}

/** Push a notification to every device of every member of an administration. */
export async function notifyOrganization(organizationId: string, payload: { title: string; body?: string; url?: string }) {
  if (!pushConfigured()) return 0;
  setup();
  const db = adminClient();
  const { data: members } = await db.from('organization_members').select('user_id').eq('organization_id', organizationId);
  const ids = (members ?? []).map((m) => m.user_id as string);
  if (!ids.length) return 0;
  const { data: subs } = await db.from('push_subscriptions').select('endpoint, subscription').in('user_id', ids);
  let sent = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification(s.subscription as webpush.PushSubscription, JSON.stringify(payload));
      sent++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await db.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
    }
  }
  return sent;
}
