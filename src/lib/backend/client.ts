'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_KEY, SUPABASE_URL, backendEnabled } from './config';

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!backendEnabled) throw new Error('Supabase is niet geconfigureerd');
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'brenqo-auth' },
    });
  }
  return client;
}

/** fetch() to our own API with the signed-in user's token attached. */
export async function authedFetch(input: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (backendEnabled) {
    const { data } = await supabase().auth.getSession();
    if (data.session) headers.set('Authorization', `Bearer ${data.session.access_token}`);
  }
  return fetch(input, { ...init, headers });
}
