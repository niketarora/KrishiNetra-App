import type { ProfileRow } from './database.types';
import { toDataError } from './errors';
import { supabase } from './supabase';

export type Profile = ProfileRow;

/**
 * The profile row is created by the `handle_new_user` trigger on signup, so a
 * missing row here means the trigger hasn't fired yet rather than an error.
 */
export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw toDataError(error, 'errors.generic');
  return data ?? null;
}

export async function updateProfile(
  userId: string,
  values: Partial<Pick<Profile, 'full_name' | 'phone' | 'language'>>,
): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single();

  if (error) throw toDataError(error, 'errors.generic');
  return data;
}
