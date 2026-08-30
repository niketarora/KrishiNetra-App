import { userClient } from '../config/supabase.js';
import type { UpdateProfileBody } from '../schemas/profile.schema.js';
import type { ProfileRow } from '../types/domain.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * The profile row is created by the `handle_new_user` trigger the moment
 * Supabase Auth creates the user. The backend deliberately does not create
 * profiles: if it did, it would race that trigger on signup.
 */

export async function getProfile(token: string, userId: string): Promise<ProfileRow> {
  const { data, error } = await userClient(token)
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw ApiError.notFound('No profile for that account yet.');

  return data as ProfileRow;
}

export async function updateProfile(
  token: string,
  userId: string,
  body: UpdateProfileBody,
): Promise<ProfileRow> {
  const updatePayload: Record<string, unknown> = { ...body };
  if (body.location_state !== undefined || body.location_district !== undefined) {
    updatePayload.location_source = 'manual';
  }

  const { data, error } = await userClient(token)
    .from('profiles')
    .update(updatePayload)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data as ProfileRow;
}
