import 'server-only';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

/**
 * Service-role client for server routes that run without a signed-in user
 * (webhooks, cron, inbound mail, public pages). It bypasses row level
 * security, so every query here scopes on organization_id itself.
 */
let admin: SupabaseClient | null = null;

export function serverBackendConfigured() {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL) && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}

export function adminClient(): SupabaseClient {
  if (!admin) {
    admin = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}

export async function userFromRequest(req: Request): Promise<User | null> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await adminClient().auth.getUser(token);
  return error ? null : data.user;
}

export type AuthResult = { user: User; error?: undefined } | { error: Response; user?: undefined };

/**
 * Signed-in member of the administration? Returns the user, or a ready-made
 * error response. `write` requires the owner or admin role.
 */
export async function requireMember(req: Request, organizationId: string, opts: { write?: boolean } = {}): Promise<AuthResult> {
  const user = await userFromRequest(req);
  if (!user) return { error: Response.json({ error: 'Niet ingelogd' }, { status: 401 }) };
  const { data } = await adminClient()
    .from('organization_members')
    .select('role')
    .eq('organization_id', organizationId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!data || (opts.write && data.role === 'viewer')) return { error: Response.json({ error: 'Geen toegang tot deze administratie' }, { status: 403 }) };
  return { user };
}

/** Any signed-in user (for features not tied to one administration). */
export async function requireUser(req: Request): Promise<AuthResult> {
  const user = await userFromRequest(req);
  if (!user) return { error: Response.json({ error: 'Niet ingelogd' }, { status: 401 }) };
  return { user };
}
