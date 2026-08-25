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
 * Screens must never import this directly — all reads and writes go through
 * `services/farms.ts` and `services/profiles.ts`. Phase 2 replaces the bodies
 * of those modules with calls to the Node/Express API, and no screen changes.
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
