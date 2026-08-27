import type { AuthError } from '@supabase/supabase-js';

import { DataError, mapAuthError, toDataError } from './errors';

const authError = (message: string, code?: string): AuthError =>
  ({ name: 'AuthApiError', message, code, status: 400 }) as AuthError;

describe('mapAuthError', () => {
  it('maps wrong credentials to a farmer-readable key', () => {
    expect(mapAuthError(authError('Invalid login credentials'))).toBe(
      'auth.errors.invalidCredentials',
    );
    expect(mapAuthError(authError('anything', 'invalid_credentials'))).toBe(
      'auth.errors.invalidCredentials',
    );
  });

  it('maps a duplicate registration', () => {
    expect(mapAuthError(authError('User already registered'))).toBe('auth.errors.emailTaken');
    expect(mapAuthError(authError('x', 'email_exists'))).toBe('auth.errors.emailTaken');
  });

  it('maps an unconfirmed email', () => {
    expect(mapAuthError(authError('Email not confirmed'))).toBe('auth.errors.emailNotConfirmed');
  });

  it('maps a weak password', () => {
    expect(mapAuthError(authError('Password should be at least 8 characters'))).toBe(
      'auth.errors.weakPassword',
    );
  });

  it('maps rate limiting', () => {
    expect(mapAuthError(authError('Email rate limit exceeded'))).toBe('auth.errors.rateLimited');
  });

  it('maps a dropped connection', () => {
    expect(mapAuthError(new Error('Network request failed'))).toBe('auth.errors.network');
  });

  it('falls back to a generic key rather than leaking an internal message', () => {
    const key = mapAuthError(authError('unexpected_failure: pg: connection refused'));

    expect(key).toBe('auth.errors.generic');
    // The point of the mapping: no database internals reach the farmer.
    expect(key).not.toContain('pg:');
  });

  it('handles a null error', () => {
    expect(mapAuthError(null)).toBe('auth.errors.generic');
  });
});

describe('toDataError', () => {
  it('reports a lost connection as such, whatever the caller expected', () => {
    const error = toDataError(new Error('Network request failed'), 'onboarding.saveError');

    expect(error).toBeInstanceOf(DataError);
    expect(error.translationKey).toBe('auth.errors.network');
  });

  it('uses the caller-supplied key for everything else', () => {
    expect(toDataError(new Error('duplicate key'), 'onboarding.saveError').translationKey).toBe(
      'onboarding.saveError',
    );
  });

  it('keeps the original error as the cause for logging', () => {
    const cause = new Error('boom');
    expect(toDataError(cause, 'errors.generic').cause).toBe(cause);
  });
});
