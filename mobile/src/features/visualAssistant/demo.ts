import type { TFunction } from 'i18next';

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
 *
 * Today this calls a temporary Supabase Edge Function
 * (`supabase/functions/visual-assistant-ask`) that forwards the image and
 * question straight to a vision-capable LLM and returns its raw text. That
 * function is documented as temporary in its own README — it is not, and
 * must not become, Engine 2. The answer is genuine model output, not a
 * KrishiNetra agricultural decision, which is why `isDemo` stays part of the
 * return shape: `false` marks a real (if unverified) answer, `true` marks the
 * one hardcoded fallback sentence used when the call fails outright.
 *
 * The file name and the module's original mock are kept deliberately — this
 * is still a temporary/demo architecture (no Engine 2, no backend/ proxy),
 * even though the text itself is now real.
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
 * Calls the temporary vision proxy and returns its answer. Throws on
 * failure — the screen owns the loading/error UI, this module only owns
 * "how do I get an answer".
 */
export async function resolveVisualAssistantAnswer(
  t: TFunction,
  observation: VisualAssistantObservation,
): Promise<VisualAssistantAnswer> {
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

  if (error || !data?.answer) {
    throw new Error(t('visualAssistant.errors.generic'));
  }

  return { answer: data.answer, isDemo: false };
}
