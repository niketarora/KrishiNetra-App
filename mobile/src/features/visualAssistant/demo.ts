import type { TFunction } from 'i18next';

import { apiFetch } from '@/services/api';
import { supabase } from '@/services/supabase';

/**
 * The Visual Assistant's answer resolver.
 *
 * This module is the one place `VisualAssistantScreen` asks a question — the
 * screen never talks to Supabase or any vision provider directly, so the
 * eventual real pipeline (Engine 2 + backend/) can replace this file's
 * internals without touching the screen at all:
 *
 *   camera image + farmer question
 *         → KrishiNetra backend
 *         → vision / speech-to-text
 *         → KrishiNetra Engine 2 (deterministic agricultural intelligence)
 *         → structured result
 *         → LLM explanation
 *         → this same "answer" string, spoken/shown the same way
 */

export type VisualAssistantState = 'idle' | 'captured' | 'asking' | 'answered' | 'error';

/** What this module sends to the vision assistant. */
export type VisualAssistantObservation = {
  /** Raw base64 JPEG bytes from expo-camera's takePictureAsync — no data: prefix. */
  imageBase64: string;
  mimeType: string;
  /** The farmer's typed question or voice transcript. */
  questionText?: string;
  /** Optional base64 recorded audio chunk for Sarvam STT transcription. */
  audioBase64?: string;
  audioMimeType?: string;
  language?: string;
};

export type VisualAssistantAnswer = {
  answer: string;
  /** Spoken WAV audio base64 string if synthesized (e.g. via Sarvam TTS). */
  audio?: string | null;
  /** Transcribed question if voice query was passed through Sarvam STT. */
  question?: string;
  /** Detected/spoken language code. */
  language?: string;
  /** Sample rate of audio in Hz (e.g. 16000). */
  sampleRate?: number;
  /** false = a real LLM answer. true = fallback. */
  isDemo: boolean;
};

/**
 * Calls the vision endpoint and returns its answer and spoken audio.
 */
export async function resolveVisualAssistantAnswer(
  t: TFunction,
  observation: VisualAssistantObservation,
): Promise<VisualAssistantAnswer> {
  // 1. Try KrishiNetra backend API
  try {
    const res = await apiFetch<{
      question?: string;
      answer: string;
      audio?: string | null;
      sampleRate?: number;
      mimeType?: string;
      language?: string;
    }>('/api/v1/ai/visual-ask', {
      method: 'POST',
      body: {
        imageBase64: observation.imageBase64,
        mimeType: observation.mimeType || 'image/jpeg',
        question: observation.questionText || '',
        audioBase64: observation.audioBase64,
        audioMimeType: observation.audioMimeType || 'audio/mp4',
        language: observation.language || 'hi',
      },
      auth: false,
      fallbackKey: 'visualAssistant.errors.generic',
      timeoutMs: 45_000,
    });
    if (res?.answer) {
      return {
        question: res.question || observation.questionText,
        answer: res.answer,
        audio: res.audio ?? null,
        sampleRate: res.sampleRate ?? 16000,
        language: res.language,
        isDemo: false,
      };
    }
  } catch (err) {
    console.warn('[VisualAssistant] Backend visual-ask failed:', err);
  }

  // 2. Try Supabase Edge Function
  try {
    const { data, error } = await supabase.functions.invoke<{
      answer?: string;
      audio?: string | null;
      error?: string;
    }>('visual-assistant-ask', {
      body: {
        imageBase64: observation.imageBase64,
        mimeType: observation.mimeType,
        question: observation.questionText || 'इस पौधे में क्या समस्या या बीमारी है?',
      },
    });

    if (!error && data?.answer) {
      return {
        question: observation.questionText,
        answer: data.answer,
        audio: data.audio ?? null,
        isDemo: false,
      };
    }
  } catch {
    // Fall through
  }

  throw new Error(t('visualAssistant.errors.generic'));
}

