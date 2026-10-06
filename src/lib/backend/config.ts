/** Supabase is used when its public URL and key are configured; otherwise Brenqo runs as a demo. */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
export const backendEnabled = !!(SUPABASE_URL && SUPABASE_KEY);
