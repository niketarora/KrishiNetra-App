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
  questionText: string;
  language?: string;
};

export type VisualAssistantAnswer = {
  answer: string;
  /** Spoken WAV audio base64 string if synthesized. */
  audio?: string | null;
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
      answer: string;
      audio?: string | null;
      sampleRate?: number;
      mimeType?: string;
    }>('/api/v1/ai/visual-ask', {
      method: 'POST',
      body: {
        imageBase64: observation.imageBase64,
        mimeType: observation.mimeType || 'image/jpeg',
        question: observation.questionText,
        language: observation.language || 'hi',
      },
      auth: false,
      fallbackKey: 'visualAssistant.errors.generic',
      timeoutMs: 45_000,
    });
    if (res?.answer) {
      return {
        answer: res.answer,
        audio: res.audio ?? null,
        sampleRate: res.sampleRate ?? 16000,
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
      audio?: string;
      error?: string;
    }>('visual-assistant-ask', {
      body: {
        imageBase64: observation.imageBase64,
        mimeType: observation.mimeType,
        question: observation.questionText,
      },
    });

    if (!error && data?.answer) {
      return { answer: data.answer, audio: data.audio ?? null, isDemo: false };
    }
  } catch {
    // Fall through
  }

  throw new Error(t('visualAssistant.errors.generic'));
}

