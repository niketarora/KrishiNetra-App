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
 *   1. Replace `request()` with real provider SMS delivery or Supabase Phone OTP.
 *   2. Replace `verify()` with real OTP verification.
 * Nothing in `PhoneEntryScreen` or screens downstream needs to change shape for that swap.
 */

const CODE_LENGTH = 6;
const EXPIRY_SECONDS = 5 * 60; // 5 minutes
const EXPIRY_MS = EXPIRY_SECONDS * 1000;
const MAX_ATTEMPTS = 5;

type OtpRecord = { code: string; expiresAt: number; attempts: number };

export type VerifyResult =
  | { success: true }
  | { success: false; reason: 'OTP_INVALID' | 'OTP_EXPIRED' | 'OTP_TOO_MANY_ATTEMPTS' };

export class DemoOtpService {
  private store = new Map<string, OtpRecord>();

  private generateCode(): string {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i += 1) {
      code += Math.floor(Math.random() * 10).toString();
    }
    return code;
  }

  /** Issues a fresh code for this phone number, replacing any still pending. */
  request(phone: string): { devCode: string; expiresInSeconds: number } {
    const devCode = this.generateCode();
    this.store.set(phone, { code: devCode, expiresAt: Date.now() + EXPIRY_MS, attempts: 0 });
    return { devCode, expiresInSeconds: EXPIRY_SECONDS };
  }

  /** Verifies the code for this phone number, returning a detailed result. */
  verify(phone: string, code: string): VerifyResult {
    const record = this.store.get(phone);
    if (!record) {
      return { success: false, reason: 'OTP_INVALID' };
    }

    if (Date.now() > record.expiresAt) {
      this.store.delete(phone);
      return { success: false, reason: 'OTP_EXPIRED' };
    }

    record.attempts += 1;
    if (record.attempts > MAX_ATTEMPTS) {
      this.store.delete(phone);
      return { success: false, reason: 'OTP_TOO_MANY_ATTEMPTS' };
    }

    if (record.code !== code.trim()) {
      return { success: false, reason: 'OTP_INVALID' };
    }

    // One-time use, same as a real OTP.
    this.store.delete(phone);
    return { success: true };
  }

  /** Clear store (useful in tests). */
  clear(): void {
    this.store.clear();
  }
}

export const demoOtpService = new DemoOtpService();
