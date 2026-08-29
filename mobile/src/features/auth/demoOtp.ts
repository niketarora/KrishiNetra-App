/**
 * DEMO OTP — a clean stand-in for real Supabase Phone OTP.
 *
 * Supabase Phone Auth cannot be turned on at all without configuring a real
 * SMS provider (Twilio/MessageBird/Vonage/etc.) in the Supabase dashboard —
 * even its "test phone numbers" feature requires the Phone provider to be
 * enabled first. This is a hackathon prototype: we do not pay for or wire up
 * SMS (IMPLEMENTATION.md rule 19), but the farmer must still be able to type
 * *any* phone number and get a working OTP for the demo to be convincing.
 *
 * So this module is entirely local: a 6-digit code is generated per phone
 * number and held in memory only — it is never written to the database,
 * never logged to a server, and never survives an app restart. Since there is
 * no SMS to receive it by, `OtpVerifyScreen` shows the code on-screen behind
 * a clearly labelled "Demo OTP" banner instead of texting it.
 *
 * --- Swapping in real Supabase Phone OTP later ---
 * Once a Phone provider is configured in the Supabase project:
 *   1. Replace `request()`'s body with `supabase.auth.signInWithOtp({ phone })`.
 *   2. Replace `verify()`'s body with
 *      `supabase.auth.verifyOtp({ phone, token: code, type: 'sms' })`, which
 *      returns a real session directly — at that point
 *      `features/auth/phoneIdentity.ts` (the synthetic-email bridge below
 *      this file) is deleted entirely, because phone becomes the actual
 *      Supabase Auth identity instead of a bridge to one.
 *   3. `OtpVerifyScreen` stops rendering the on-screen demo code.
 * Nothing in `AuthContext`, `PhoneEntryScreen` or any screen downstream of
 * `requestPhoneOtp`/`verifyPhoneOtp` needs to change shape for that swap.
 */

const CODE_LENGTH = 6;
const EXPIRY_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

type OtpRecord = { code: string; expiresAt: number; attempts: number };

const store = new Map<string, OtpRecord>();

function generateCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) code += Math.floor(Math.random() * 10).toString();
  return code;
}

export interface OtpProvider {
  /** Issues a fresh code for this phone number, replacing any still pending. */
  request(phone: string): { devCode: string };
  /** True and consumes the code on a correct, unexpired match; false otherwise. */
  verify(phone: string, code: string): boolean;
}

class DemoOtpProvider implements OtpProvider {
  request(phone: string): { devCode: string } {
    const devCode = generateCode();
    store.set(phone, { code: devCode, expiresAt: Date.now() + EXPIRY_MS, attempts: 0 });
    return { devCode };
  }

  verify(phone: string, code: string): boolean {
    const record = store.get(phone);
    if (!record) return false;

    if (Date.now() > record.expiresAt) {
      store.delete(phone);
      return false;
    }

    record.attempts += 1;
    if (record.attempts > MAX_ATTEMPTS) {
      store.delete(phone);
      return false;
    }

    if (record.code !== code.trim()) return false;

    // One-time use, same as a real OTP.
    store.delete(phone);
    return true;
  }
}

export const demoOtpProvider: OtpProvider = new DemoOtpProvider();
