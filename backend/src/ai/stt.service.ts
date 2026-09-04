import { getEnv } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Speech-to-text, behind one adapter.
 *
 * Sarvam AI is used because it is built for Indian languages, which is what
 * this app needs and what generic providers handle worst. Only this file knows
 * that; the controller and the app deal in "audio in, text out", so the
 * provider can be replaced without touching either.
 *
 * The subscription key is server-side. The app uploads audio to our API and
 * never talks to Sarvam directly — §10 of the phase document.
 *
 * NOTE: the exact request and response field names below follow Sarvam's
 * documented speech-to-text API. If they have changed, this is the only file
 * that needs editing, and `parseTranscript` below already tolerates the two
 * response shapes their docs have used.
 */

export type Transcription = {
  text: string;
  /** BCP-47 as the provider reported it, e.g. `hi-IN`. Null if not returned. */
  language: string | null;
};

/**
 * Sarvam expects a BCP-47 tag. The app knows only `en` / `hi`, so widen those
 * to the Indian variants the provider recognises.
 *
 * `unknown` asks the provider to detect the language, which is what we want
 * when the farmer has not told us — a farmer whose app is in English may still
 * speak Hindi, and forcing `en-IN` would transcribe it as nonsense.
 */
const REGIONAL_STT_MAP: Record<string, string> = {
  hi: 'hi-IN',
  bn: 'bn-IN',
  kn: 'kn-IN',
  ml: 'ml-IN',
  mr: 'mr-IN',
  or: 'od-IN',
  od: 'od-IN',
  pa: 'pa-IN',
  ta: 'ta-IN',
  te: 'te-IN',
  gu: 'gu-IN',
  as: 'as-IN',
  ur: 'ur-IN',
  mai: 'hi-IN',
  ne: 'hi-IN',
  kok: 'hi-IN',
  doi: 'hi-IN',
  brx: 'hi-IN',
  sa: 'hi-IN',
  ks: 'ur-IN',
  sd: 'ur-IN',
  sat: 'od-IN',
  mni: 'bn-IN',
  en: 'en-IN',
};

/**
 * Detects the Indian language script from text when provider language is unknown.
 */
export function detectLanguageFromText(text: string): string | null {
  if (/[\u0900-\u097F]/.test(text)) return 'hi-IN'; // Devanagari (Hindi, Marathi, Sanskrit, Maithili, Bodo, Dogri, Konkani, Nepali)
  if (/[\u0C00-\u0C7F]/.test(text)) return 'te-IN'; // Telugu
  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta-IN'; // Tamil
  if (/[\u0980-\u09FF]/.test(text)) return 'bn-IN'; // Bengali / Assamese
  if (/[\u0A80-\u0AFF]/.test(text)) return 'gu-IN'; // Gujarati
  if (/[\u0A00-\u0A7F]/.test(text)) return 'pa-IN'; // Gurmukhi / Punjabi
  if (/[\u0C80-\u0CFF]/.test(text)) return 'kn-IN'; // Kannada
  if (/[\u0D00-\u0D7F]/.test(text)) return 'ml-IN'; // Malayalam
  if (/[\u0B00-\u0B7F]/.test(text)) return 'od-IN'; // Odia
  if (/[\u0600-\u06FF]/.test(text)) return 'ur-IN'; // Arabic / Urdu / Kashmiri / Sindhi
  return null;
}

export function toProviderLanguage(language: string | undefined): string {
  if (!language || language === 'unknown' || language === 'auto' || language === 'en' || language === 'en-IN') {
    return 'unknown';
  }

  const base = language.split('-')[0]?.toLowerCase() ?? '';
  return REGIONAL_STT_MAP[base] ?? 'unknown';
}

/** Reads the transcript out of a provider response without assuming one shape. */
export function parseTranscript(payload: unknown): Transcription | null {
  if (!payload || typeof payload !== 'object') return null;

  const body = payload as Record<string, unknown>;
  const raw = body.transcript ?? body.text;

  if (typeof raw !== 'string') return null;

  const text = raw.trim();
  if (text === '') return null;

  let language = body.language_code ?? body.language ?? body.detected_language_code;
  if (typeof language !== 'string' || !language || language === 'unknown') {
    language = detectLanguageFromText(text) ?? null;
  }

  return {
    text,
    language: typeof language === 'string' && language !== '' ? language : null,
  };
}

export async function transcribe(
  audio: { buffer: Buffer; filename: string; mimeType: string },
  language: string | undefined,
  options: { timeoutMs?: number } = {},
): Promise<Transcription> {
  const env = getEnv();

  if (!env.SARVAM_API_KEY) {
    throw ApiError.notConnected('Voice input is not connected yet.');
  }

  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(audio.buffer)], { type: audio.mimeType }), audio.filename);
  form.append('model', env.SARVAM_MODEL);
  form.append('language_code', toProviderLanguage(language));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 30_000);

  try {
    const response = await fetch(env.SARVAM_API_URL, {
      method: 'POST',
      headers: { 'api-subscription-key': env.SARVAM_API_KEY },
      body: form,
      signal: controller.signal,
    });

    if (!response.ok) {
      // The provider's body can echo the key's plan and quota. Log it, never
      // return it.
      console.error(`[stt] provider returned HTTP ${response.status}`);
      throw ApiError.notConnected('Could not understand the recording. Please try again.');
    }

    const transcription = parseTranscript(await response.json());

    if (!transcription) {
      // Silence, background noise, or speech the provider could not resolve.
      // Inventing a plausible sentence here would put words in the farmer's
      // mouth and then answer them.
      throw ApiError.invalidRequest('No speech was recognised. Please try again.');
    }

    return transcription;
  } catch (error) {
    if (error instanceof ApiError) throw error;

    console.error('[stt] provider call failed:', error);
    throw ApiError.notConnected('Voice input is unavailable right now.');
  } finally {
    clearTimeout(timeout);
  }
}
