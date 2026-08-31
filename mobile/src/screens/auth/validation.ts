/**
 * Client-side validation returns translation keys, never sentences, so the
 * caller renders them in the farmer's language.
 *
 * These checks exist to save a round trip and give an instant, specific
 * message. Supabase re-validates everything server-side regardless — this is
 * never the security boundary.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Supabase's own default minimum; kept in step with the project's Auth settings. */
export const MIN_PASSWORD_LENGTH = 8;

export function validateEmail(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return 'auth.errors.emailRequired';
  if (!EMAIL_PATTERN.test(trimmed)) return 'auth.errors.emailInvalid';
  return null;
}

export function validatePassword(value: string): string | null {
  if (!value) return 'auth.errors.passwordRequired';
  if (value.length < MIN_PASSWORD_LENGTH) return 'auth.errors.passwordTooShort';
  return null;
}

export function validateName(value: string): string | null {
  if (!value.trim()) return 'auth.errors.nameRequired';
  return null;
}

/** Indian mobile numbers: 10 digits, starting 6–9. A leading +91/91/0 is stripped before checking. */
const PHONE_PATTERN = /^[6-9]\d{9}$/;

export function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  return digits;
}

export function validatePhone(value: string): string | null {
  if (!value.trim()) return 'auth.errors.phoneRequired';
  if (!PHONE_PATTERN.test(normalizePhone(value))) return 'auth.errors.phoneInvalid';
  return null;
}

export function validateOtp(value: string): string | null {
  const digits = value.replace(/\D/g, '');
  if (!digits) return 'auth.errors.otpRequired';
  if (digits.length !== 6) return 'auth.errors.otpInvalid';
  return null;
}
