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

const DEFAULT_TIMEOUT_MS = 35_000;

/** The TRD §15 envelope, as it arrives on the wire. */
type ApiEnvelope<T> =
  | { success: true; data: T; message?: string }
  | { success: false; error: { code: string; message: string } };

const CANDIDATE_BASE_URLS: string[] = Array.from(
  new Set(
    [
      process.env.EXPO_PUBLIC_API_URL,
      'http://127.0.0.1:4000',
      'http://192.168.1.86:4000',
      'http://10.0.2.2:4000',
      'https://krishinetra-app-1.onrender.com',
    ].filter(Boolean) as string[],
  ),
);

let workingBaseUrl: string = CANDIDATE_BASE_URLS[0] || 'http://127.0.0.1:4000';

export function getApiBaseUrl(): string {
  return workingBaseUrl;
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

  const urlsToTry = [workingBaseUrl, ...CANDIDATE_BASE_URLS.filter((u) => u !== workingBaseUrl)];
  let lastCause: unknown = null;

  for (const baseUrl of urlsToTry) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      let envelope: ApiEnvelope<T>;
      try {
        envelope = (await response.json()) as ApiEnvelope<T>;
      } catch (cause) {
        throw new DataError(fallbackKey, cause);
      }

      if (!response.ok || !envelope.success) {
        const error = 'error' in envelope ? envelope.error : undefined;
        throw toApiError(error?.code, fallbackKey);
      }

      workingBaseUrl = baseUrl;
      return envelope.data;
    } catch (cause) {
      clearTimeout(timeout);
      if (cause instanceof DataError && cause.translationKey !== 'auth.errors.network') {
        throw cause;
      }
      lastCause = cause;
    }
  }

  throw new DataError('auth.errors.network', lastCause);
}

/**
 * PostgREST and Postgres both hand back `numeric` columns as strings in places.
 * The backend normalises on the way out, but coercing again here means a stray
 * string can never reach a screen that expects a number.
 */
export function asNumber(value: unknown): number {
  return typeof value === 'number' ? value : Number(value);
}
