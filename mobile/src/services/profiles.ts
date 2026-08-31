import { apiFetch } from './api';
import type { ProfileRow } from './database.types';

export type Profile = ProfileRow;

/**
 * The profile row is created by the `handle_new_user` trigger on signup, so a
 * missing row means the trigger hasn't fired yet rather than an error.
 *
 * Since Phase 2 these call the Node/Express API. The backend deliberately does
 * not create profiles either — doing so would race that trigger.
 */

export async function getProfile(_userId: string): Promise<Profile | null> {
  try {
    return await apiFetch<Profile>('/api/v1/farmers/me', { fallbackKey: 'errors.generic' });
  } catch (error) {
    // Phase 1 treated "no row yet" as null rather than a failure, and the Home
    // greeting still relies on that. Anything else is a real error.
    if (error instanceof Error && error.cause === 'NOT_FOUND') return null;
    throw error;
  }
}

export async function updateProfile(
  _userId: string,
  values: Partial<
    Pick<
      Profile,
      | 'full_name'
      | 'phone'
      | 'email'
      | 'language'
      | 'in_app_alerts'
      | 'sms_alerts'
      | 'voice_alerts'
      | 'location_latitude'
      | 'location_longitude'
      | 'location_city'
      | 'location_district'
      | 'location_state'
      | 'location_country'
      | 'location_source'
    >
  >,
): Promise<Profile> {
  return apiFetch<Profile>('/api/v1/farmers/me', {
    method: 'PATCH',
    body: values,
    fallbackKey: 'errors.generic',
  });
}
