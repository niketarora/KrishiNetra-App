import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { getEnv } from './env.js';

/**
 * Two factory functions, and only two.
 *
 * `userClient` carries the farmer's own access token, so Postgres evaluates
 * Row Level Security as that farmer. It is the enforcement floor: if a
 * controller ever forgets an ownership check, the database still returns
 * nothing.
 *
 * `adminClient` bypasses RLS entirely. It must NEVER be called from a request
 * path that returns farmer-owned rows. In Phase 2 it exists only for
 * reference-data writes (seeding, and Phase 3 ingestion).
 */

/**
 * A fresh client per request. Do not cache these by token: a shared client
 * that remembered a session would leak one farmer's identity into another's
 * request.
 */
export function userClient(accessToken: string): SupabaseClient {
  const env = getEnv();

  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/**
 * Service role. Reference-data writes and identity provisioning only —
 * see the note above. Never called from a path that returns farmer-owned rows.
 */
export function adminClient(): SupabaseClient {
  const env = getEnv();

  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/**
 * Used by requireAuth to verify a token. Anon key, no session: this client
 * exists purely to ask Supabase Auth who a token belongs to.
 */
export function authClient(): SupabaseClient {
  const env = getEnv();

  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
