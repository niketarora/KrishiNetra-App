import type { AuthError, PostgrestError } from '@supabase/supabase-js';

/**
 * Translation keys for auth failures. Supabase returns developer-facing
 * English strings; a farmer must never see one, so every known case is mapped
 * to a translated sentence and everything else falls back to a generic line.
 * TRD §15: never surface internal messages to the user.
 */
export type AuthErrorKey =
  | 'auth.errors.invalidCredentials'
  | 'auth.errors.emailTaken'
  | 'auth.errors.emailNotConfirmed'
  | 'auth.errors.weakPassword'
  | 'auth.errors.network'
  | 'auth.errors.rateLimited'
  | 'auth.errors.generic';

export function mapAuthError(error: AuthError | Error | null): AuthErrorKey {
  if (!error) return 'auth.errors.generic';

  const code = 'code' in error ? String(error.code ?? '') : '';
  const message = error.message?.toLowerCase() ?? '';

  if (code === 'invalid_credentials' || message.includes('invalid login credentials')) {
    return 'auth.errors.invalidCredentials';
  }
  if (
    code === 'user_already_exists' ||
    code === 'email_exists' ||
    message.includes('already registered') ||
    message.includes('already been registered')
  ) {
    return 'auth.errors.emailTaken';
  }
  if (code === 'email_not_confirmed' || message.includes('email not confirmed')) {
    return 'auth.errors.emailNotConfirmed';
  }
  if (code === 'weak_password' || message.includes('password should be at least')) {
    return 'auth.errors.weakPassword';
  }
  if (code === 'over_request_rate_limit' || message.includes('rate limit')) {
    return 'auth.errors.rateLimited';
  }
  if (
    message.includes('network request failed') ||
    message.includes('failed to fetch') ||
    message.includes('timeout')
  ) {
    return 'auth.errors.network';
  }

  return 'auth.errors.generic';
}

/** Thrown by the data services so screens can show translated copy. */
export class DataError extends Error {
  readonly translationKey: string;

  /**
   * True when the failure means "there is nothing here yet" rather than "this
   * broke" — a data source the backend has not connected, or a resource the
   * farmer has not created.
   *
   * Services use it to turn an expected absence into `null`, so a tile can show
   * its empty state instead of an error banner. It never suppresses a real
   * fault: transport, auth and server errors all leave it false.
   */
  readonly absent: boolean;

  constructor(translationKey: string, cause?: unknown, options: { absent?: boolean } = {}) {
    super(translationKey);
    this.name = 'DataError';
    this.translationKey = translationKey;
    this.cause = cause;
    this.absent = options.absent ?? false;
  }
}

export function toDataError(error: PostgrestError | Error | null, fallbackKey: string): DataError {
  const message = error?.message?.toLowerCase() ?? '';
  if (message.includes('network request failed') || message.includes('failed to fetch')) {
    return new DataError('auth.errors.network', error);
  }
  return new DataError(fallbackKey, error);
}

/**
 * Map an API error code (docs/PHASE2_IMPLEMENTATION.md §7.4) onto a translation
 * key.
 *
 * The backend already guarantees its messages are safe to show, but they are
 * English and written for a developer reading a log. The farmer sees translated
 * copy instead, so only the code crosses into the UI.
 */
export function toApiError(code: string | undefined, fallbackKey: string): DataError {
  switch (code) {
    case 'UNAUTHENTICATED':
      // The session lapsed. AuthContext will route back to sign-in; this is
      // only what the current screen shows in the meantime.
      return new DataError('auth.errors.generic', code);
    case 'SERVICE_NOT_CONNECTED':
    case 'NOT_FOUND':
      // Nothing is wrong — the data source is not connected yet, or the farmer
      // has not created this resource. Callers may turn it into an empty state.
      return new DataError(fallbackKey, code, { absent: true });
    case 'INVALID_REQUEST':
    case 'CONFLICT':
    case 'FORBIDDEN':
    case 'INTERNAL_ERROR':
      return new DataError(fallbackKey, code);
    default:
      return new DataError(fallbackKey, code);
  }
}
