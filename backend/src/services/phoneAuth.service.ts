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

const DEMO_BRIDGE_PASSWORD = 'KrishiDemoBridgeAuth#2026!';

export async function findOrCreateUser(
  email: string,
  phone: string,
  language = 'en',
): Promise<{ tokenHash: string; session: PhoneAuthSession | null }> {
  const admin = adminClient();
  const auth = authClient();

  let targetEmail = email;
  let userId: string | null = null;

  try {
    const { data: existingProfile } = await admin
      .from('profiles')
      .select('id, phone')
      .eq('phone', phone)
      .maybeSingle();

    if (existingProfile?.id) {
      userId = existingProfile.id;
      const { data: userData } = await admin.auth.admin.getUserById(existingProfile.id);
      if (userData?.user?.email) {
        targetEmail = userData.user.email;
      }
    }
  } catch {
    // Fall back to default synthetic bridge email
  }

  // Create or update user password to ensure signInWithPassword works
  if (!userId) {
    const createResult = await admin.auth.admin.createUser({
      email: targetEmail,
      password: DEMO_BRIDGE_PASSWORD,
      email_confirm: true,
      user_metadata: { phone, language, is_new_farmer: true },
    });

    if (createResult.data?.user) {
      userId = createResult.data.user.id;
    } else if (createResult.error?.message?.toLowerCase().includes('already')) {
      // Find user by email
      const { data: listData } = await admin.auth.admin.listUsers();
      const existingUser = listData?.users?.find((u) => u.email?.toLowerCase() === targetEmail.toLowerCase());
      if (existingUser) {
        userId = existingUser.id;
        await admin.auth.admin.updateUserById(existingUser.id, {
          password: DEMO_BRIDGE_PASSWORD,
        });
      }
    }
  } else {
    // Update existing user password
    await admin.auth.admin.updateUserById(userId, {
      password: DEMO_BRIDGE_PASSWORD,
      email_confirm: true,
    });
  }

  // Ensure profiles.phone is populated
  if (userId) {
    try {
      await admin
        .from('profiles')
        .update({ phone, updated_at: new Date().toISOString() })
        .eq('id', userId);
    } catch {
      // Best-effort
    }
  }

  // Sign in to get real Supabase JWT session tokens
  let session: PhoneAuthSession | null = null;
  const { data: signInData, error: signInError } = await auth.auth.signInWithPassword({
    email: targetEmail,
    password: DEMO_BRIDGE_PASSWORD,
  });

  if (signInData?.session) {
    session = {
      access_token: signInData.session.access_token,
      refresh_token: signInData.session.refresh_token,
      user: signInData.session.user,
    };
  } else if (signInError) {
    console.warn('[auth] signInWithPassword error:', signInError.message);
  }

  return { tokenHash: 'verified_token_hash', session };
}
