import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

import type { Database } from './database.types';
import { secureSessionStorage } from './sessionStorage';

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

/**
 * The only Supabase client in the app.
 *
 * Screens must never import this directly. Since Phase 2 the only things that
 * use it are authentication (sign-up, sign-in, sign-out, session persistence)
 * and `getAccessToken` below — farm and profile data now travels through the
 * Express API in `services/api.ts`.
 *
 * The anon key is publishable by design; every table is protected by RLS, so
 * a token only ever reaches its owner's rows. The service-role key must never
 * appear in this project.
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: secureSessionStorage,
    autoRefreshToken: true,
    persistSession: true,
    // No deep-link auth callback in Phase 1 (email + password only).
    detectSessionInUrl: false,
  },
});

/**
 * The current access token, or null when nobody is signed in.
 *
 * `services/api.ts` calls this to authorise its requests. Keeping it here means
 * the transport layer never imports the Supabase query surface, so the rule
 * that this file is the app's only database client still holds.
 */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/**
 * Public object URL from the project's Supabase Storage.
 */
export function publicStorageUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${supabaseUrl}/storage/v1/object/public/${cleanPath}`;
}

