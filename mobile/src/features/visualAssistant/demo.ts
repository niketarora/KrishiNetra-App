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

/** What this module sends to the temporary vision proxy. */
export type VisualAssistantObservation = {
  /** Raw base64 JPEG bytes from expo-camera's takePictureAsync — no data: prefix. */
  imageBase64: string;
  mimeType: string;
  /** The farmer's typed question — a temporary stand-in for real speech-to-text. */
  questionText: string;
};

export type VisualAssistantAnswer = {
  answer: string;
  /** false = a real (unverified) LLM answer. true = the fallback sentence
   * used only when the network call itself fails — never confuse the two. */
  isDemo: boolean;
};

/**
 * Calls the vision proxy and returns its answer. Throws on
 * failure — the screen owns the loading/error UI, this module only owns
 * "how do I get an answer".
 */
export async function resolveVisualAssistantAnswer(
  t: TFunction,
  observation: VisualAssistantObservation,
): Promise<VisualAssistantAnswer> {
  // 1. Try KrishiNetra backend API
  try {
    const res = await apiFetch<{ answer: string }>('/api/v1/ai/visual-ask', {
      method: 'POST',
      body: {
        imageBase64: observation.imageBase64,
        mimeType: observation.mimeType,
        question: observation.questionText,
      },
      fallbackKey: 'visualAssistant.errors.generic',
    });
    if (res?.answer) {
      return { answer: res.answer, isDemo: false };
    }
  } catch (err) {
    console.warn('[VisualAssistant] Backend visual-ask failed:', err);
  }

  // 2. Try Supabase Edge Function
  try {
    const { data, error } = await supabase.functions.invoke<{ answer?: string; error?: string }>(
      'visual-assistant-ask',
      {
        body: {
          imageBase64: observation.imageBase64,
          mimeType: observation.mimeType,
          question: observation.questionText,
        },
      },
    );

    if (!error && data?.answer) {
      return { answer: data.answer, isDemo: false };
    }
  } catch {
    // Fall through
  }

  throw new Error(t('visualAssistant.errors.generic'));
}

