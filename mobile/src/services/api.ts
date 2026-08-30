import { DataError, toApiError } from './errors';
import { getAccessToken } from './supabase';

/**
 * The app's transport to the KrishiNetra backend.
 *
 * Phase 2 moved every farm and profile read/write off direct Supabase queries
 * and onto the Express API. Only `services/farms.ts` and `services/profiles.ts`
 * call this, and only screens call those — the seam Phase 1 established is
 * unchanged.
 *
 * Authentication is unaffected: sign-up and sign-in still go straight to
 * Supabase Auth from the client. This layer just carries the resulting access
 * token so the backend knows who is calling.
 */

const DEFAULT_TIMEOUT_MS = 15_000;

/** The TRD §15 envelope, as it arrives on the wire. */
type ApiEnvelope<T> =
  | { success: true; data: T; message?: string }
  | { success: false; error: { code: string; message: string } };

export function getApiBaseUrl(): string {
  // On an Android emulator the host machine is 10.0.2.2, not localhost.
  return process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:4000';
}

type ApiRequest = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Translation key used when the failure has no more specific mapping. */
  fallbackKey: string;
  /**
   * Override the default deadline. Speech synthesis returns a whole audio file
   * and takes noticeably longer than a JSON read, so it asks for more.
   */
  timeoutMs?: number;
  /** Whether to attach the user's access token. Default true. */
  auth?: boolean;
};

/**
 * Perform one API call and unwrap the envelope.
 *
 * Every failure — transport, timeout, non-2xx, or a `success: false` body —
 * leaves here as a `DataError` carrying a translation key, which is the shape
 * screens have always handled.
 */
export async function apiFetch<T>(
  path: string,
  { method = 'GET', body, fallbackKey, timeoutMs = DEFAULT_TIMEOUT_MS, auth = true }: ApiRequest,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  if (auth) {
    const token = await getAccessToken();
    if (!token) {
      // The session expired between the screen rendering and this call.
      throw new DataError('auth.errors.generic');
    }
    headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (cause) {
    // A dead server, no connectivity, or the abort above.
    throw new DataError('auth.errors.network', cause);
  } finally {
    clearTimeout(timeout);
  }

  let envelope: ApiEnvelope<T>;
  try {
    envelope = (await response.json()) as ApiEnvelope<T>;
  } catch (cause) {
    // A proxy or crash returned something that is not our envelope.
    throw new DataError(fallbackKey, cause);
  }

  if (!response.ok || !envelope.success) {
    const error = 'error' in envelope ? envelope.error : undefined;
    throw toApiError(error?.code, fallbackKey);
  }

  return envelope.data;
}

/**
 * PostgREST and Postgres both hand back `numeric` columns as strings in places.
 * The backend normalises on the way out, but coercing again here means a stray
 * string can never reach a screen that expects a number.
 */
export function asNumber(value: unknown): number {
  return typeof value === 'number' ? value : Number(value);
}
