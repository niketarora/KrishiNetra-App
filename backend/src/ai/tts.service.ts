import { getEnv } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { concatWav, WavError } from '../utils/wav.js';

/**
 * Text-to-speech, behind one adapter — the mirror image of `stt.service.ts`.
 *
 * Sarvam is used for the same reason it is used for transcription: this is an
 * app for farmers speaking Hindi and English-with-an-Indian-accent, and a
 * generic provider reads Devanagari worst. As with every other provider in
 * this directory, only this file knows whose voice it is. The app asks our API
 * for "audio for this sentence" and gets back a WAV.
 *
 * The subscription key stays server-side, exactly as §10 of the phase document
 * requires — the app never calls Sarvam directly.
 */

export type Speech = {
  /** A complete WAV file, base64-encoded for the JSON envelope. */
  audio: string;
  mimeType: string;
  /** Sample rate of the returned audio, so the client can log or check it. */
  sampleRate: number;
};

/** 16 kHz mono is all speech needs, and a smaller download than the default. */
const SPEECH_SAMPLE_RATE = 16_000;

/**
 * An upper bound on what will be spoken aloud.
 *
 * The prompt already asks for two or three sentences and the model is capped
 * at 400 output tokens, so this is a backstop rather than a routine trim: a
 * runaway answer would otherwise turn into a multi-megabyte download on a
 * rural connection. Text is cut at a sentence boundary where one is near the
 * limit, because stopping mid-word sounds like a fault rather than an ending.
 */
export const MAX_SPEAK_CHARS = 1000;

export function trimForSpeech(text: string): string {
  const clean = text.trim();
  if (clean.length <= MAX_SPEAK_CHARS) return clean;

  const cut = clean.slice(0, MAX_SPEAK_CHARS);
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('। '), cut.lastIndexOf('? '));

  // Only honour a sentence break in the last quarter; an early one would throw
  // away most of the answer to gain a tidier ending.
  return lastStop > MAX_SPEAK_CHARS * 0.75 ? cut.slice(0, lastStop + 1) : cut;
}

/**
 * Sarvam wants a BCP-47 tag and, unlike transcription, has no `unknown` to
 * fall back on — it must be told which language to read the text in.
 */
const REGIONAL_TTS_MAP: Record<string, string> = {
  hi: 'hi-IN',
  bn: 'bn-IN',
  kn: 'kn-IN',
  ml: 'ml-IN',
  mr: 'mr-IN',
  or: 'od-IN',
  pa: 'pa-IN',
  ta: 'ta-IN',
  te: 'te-IN',
  gu: 'gu-IN',
  en: 'en-IN',
};

export function toSpeechLanguage(language: string | undefined): string {
  if (!language) return 'en-IN';
  const base = language.split('-')[0]?.toLowerCase() ?? '';
  return REGIONAL_TTS_MAP[base] ?? 'en-IN';
}


/** Pulls the base64 audio chunks out of a provider response. */
export function parseAudioChunks(payload: unknown): string[] | null {
  if (!payload || typeof payload !== 'object') return null;

  const { audios } = payload as { audios?: unknown };
  if (!Array.isArray(audios) || audios.length === 0) return null;

  const chunks = audios.filter((chunk): chunk is string => typeof chunk === 'string' && chunk !== '');
  return chunks.length === audios.length ? chunks : null;
}

export async function synthesize(
  text: string,
  language: string | undefined,
  options: { timeoutMs?: number } = {},
): Promise<Speech> {
  const env = getEnv();

  if (!env.SARVAM_API_KEY) {
    throw ApiError.notConnected('The voice is not connected yet.');
  }

  const spoken = trimForSpeech(text);
  if (spoken === '') throw ApiError.invalidRequest('There is nothing to say.');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 30_000);

  try {
    const response = await fetch(env.SARVAM_TTS_API_URL, {
      method: 'POST',
      headers: {
        'api-subscription-key': env.SARVAM_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: [spoken],
        target_language_code: toSpeechLanguage(language),
        model: env.SARVAM_TTS_MODEL,
        speaker: env.SARVAM_TTS_SPEAKER,
        speech_sample_rate: SPEECH_SAMPLE_RATE,
        enable_preprocessing: true,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      // The provider's body names the key's plan and quota. Log the status,
      // never the body.
      console.error(`[tts] provider returned HTTP ${response.status}`);
      throw ApiError.notConnected('The voice is unavailable right now.');
    }

    const chunks = parseAudioChunks(await response.json());
    if (!chunks) throw ApiError.notConnected('The voice returned no audio.');

    // Long answers come back as several separate WAVs, in order.
    const audio = concatWav(chunks.map((chunk) => Buffer.from(chunk, 'base64')));

    return {
      audio: audio.toString('base64'),
      mimeType: 'audio/wav',
      sampleRate: SPEECH_SAMPLE_RATE,
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;

    if (error instanceof WavError) {
      console.error('[tts] could not join provider audio:', error.message);
      throw ApiError.notConnected('The voice returned audio we could not play.');
    }

    console.error('[tts] provider call failed:', error);
    throw ApiError.notConnected('The voice is unavailable right now.');
  } finally {
    clearTimeout(timeout);
  }
}
