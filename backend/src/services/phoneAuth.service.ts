import type { User } from '@supabase/supabase-js';

import { adminClient, authClient } from '../config/supabase.js';
import { ApiError } from '../utils/ApiError.js';

const EMAIL_DOMAIN = 'phone.demo.krishinetra.app';

/**
 * The real Supabase session minted for a verified phone number. Null when the
 * backend could not exchange the magiclink hash — the caller still gets the
 * hash and can complete verification client-side.
 */
export type PhoneAuthSession = {
  access_token: string;
  refresh_token: string;
  user: User;
};

export function phoneToBridgeEmail(normalizedPhone: string): string {
  return `p${normalizedPhone}@${EMAIL_DOMAIN}`;
}

export async function findOrCreateUser(
  email: string,
  phone: string,
  language = 'en',
): Promise<{ tokenHash: string; session: PhoneAuthSession | null }> {
  const admin = adminClient();

  // Check if a profile with this phone number already exists
  let targetEmail = email;
  try {
    const { data: existingProfile } = await admin
      .from('profiles')
      .select('id, phone')
      .eq('phone', phone)
      .maybeSingle();

    if (existingProfile?.id) {
      const { data: userData } = await admin.auth.admin.getUserById(existingProfile.id);
      if (userData?.user?.email) {
        targetEmail = userData.user.email;
      }
    }
  } catch {
    // Fall back to default synthetic bridge email
  }

  // Try generating magiclink first.
  let linkResult = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: targetEmail,
  });

  if (linkResult.error) {
    // If the user does not exist yet, create them.
    const createResult = await admin.auth.admin.createUser({
      email: targetEmail,
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
      email: targetEmail,
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

  // Verify token hash on backend using anon authClient to get real Supabase session tokens
  let session: PhoneAuthSession | null = null;
  try {
    const auth = authClient();
    const { data: verifyData } = await auth.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'magiclink',
    });
    if (verifyData?.session) {
      session = {
        access_token: verifyData.session.access_token,
        refresh_token: verifyData.session.refresh_token,
        user: verifyData.session.user,
      };
    }
  } catch (err) {
    console.warn('[auth] backend verifyOtp notice:', err);
  }

  return { tokenHash, session };
}
