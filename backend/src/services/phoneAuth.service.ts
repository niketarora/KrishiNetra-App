import { adminClient } from '../config/supabase.js';
import { ApiError } from '../utils/ApiError.js';

const EMAIL_DOMAIN = 'phone.demo.krishinetra.app';

export function phoneToBridgeEmail(normalizedPhone: string): string {
  return `p${normalizedPhone}@${EMAIL_DOMAIN}`;
}

export async function findOrCreateUser(
  email: string,
  phone: string,
  language = 'en',
): Promise<{ tokenHash: string }> {
  const admin = adminClient();

  // Try generating magiclink first.
  let linkResult = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });

  if (linkResult.error) {
    // If the user does not exist yet, create them.
    const createResult = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { phone, language },
    });

    if (createResult.error) {
      // If error is "User already registered" (race condition), retry generateLink
      if (!createResult.error.message?.toLowerCase().includes('already')) {
        throw new ApiError('AUTH_UNAVAILABLE', 'Unable to create user account.');
      }
    }

    // Retry generating link after creation
    linkResult = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });

    if (linkResult.error) {
      throw new ApiError('AUTH_UNAVAILABLE', 'Unable to generate authentication token.');
    }
  }

  const userId = linkResult.data.user?.id;
  const tokenHash = linkResult.data.properties?.hashed_token;

  if (!tokenHash) {
    throw new ApiError('AUTH_UNAVAILABLE', 'Authentication token was not generated.');
  }

  // Ensure profiles.phone is populated (pre-existing rows or trigger edge-cases)
  if (userId) {
    try {
      await admin
        .from('profiles')
        .update({ phone, updated_at: new Date().toISOString() })
        .eq('id', userId);
    } catch {
      // Best-effort update — profile trigger handle_new_user already handles creation
    }
  }

  return { tokenHash };
}
