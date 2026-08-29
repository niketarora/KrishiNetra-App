import * as SecureStore from 'expo-secure-store';

/**
 * Bridges a demo-OTP-verified phone number to a real Supabase Auth session.
 *
 * The task requires the farmer's identity to be `auth.users.id`, not the
 * phone number itself — but Supabase Auth has no "just trust me, this phone
 * is verified" API; sign-up/sign-in need an email+password or a real Phone
 * OTP exchange (see `demoOtp.ts`'s header comment for why that's not
 * available here). So each phone number is mapped to a synthetic bridging
 * email and a random password, generated once and kept in `expo-secure-store`
 * — the same store `services/sessionStorage.ts` already uses for session
 * tokens, so nothing new is added to the device's trust surface.
 *
 * This email is purely an implementation detail: it is never shown to the
 * farmer (Profile displays the separate, genuinely-optional `profiles.email`
 * column instead), and it never reaches `profiles.email`.
 *
 * Known limitation, not hidden: the password lives on-device only, so the
 * *same* phone number on a different device or after a reinstall creates a
 * new account until real Supabase Phone OTP replaces this bridge entirely
 * (see `demoOtp.ts`). It is not a meaningful security boundary either way —
 * the OTP step is what stands in for "this phone is verified"; the password
 * only exists to satisfy Supabase Auth's API shape.
 */

const EMAIL_DOMAIN = 'phone.demo.krishinetra.app';
const PASSWORD_KEY_PREFIX = 'krishinetra.demoOtpPw.';

export function phoneToBridgeEmail(normalizedPhone: string): string {
  return `p${normalizedPhone}@${EMAIL_DOMAIN}`;
}

function randomPassword(): string {
  // Not cryptographically significant (see file comment) — just needs to be
  // long enough that Supabase's password-strength check accepts it and
  // nobody can type it by accident.
  return Array.from({ length: 4 }, () => Math.random().toString(36).slice(2)).join('');
}

/** Returns this device's password for `phone`, generating and storing one on first use. */
export async function getOrCreateBridgePassword(normalizedPhone: string): Promise<string> {
  const key = `${PASSWORD_KEY_PREFIX}${normalizedPhone}`;
  const existing = await SecureStore.getItemAsync(key);
  if (existing) return existing;

  const created = randomPassword();
  await SecureStore.setItemAsync(key, created);
  return created;
}
