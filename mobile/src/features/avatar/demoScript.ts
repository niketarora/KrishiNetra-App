import type { TFunction } from 'i18next';

import type { Farm } from '@/services/farms';

import type { QuestionKey } from './avatarMachine';

/**
 * The scripted Phase 1 conversation.
 *
 * The five questions come from the prototype. The answers do NOT: the
 * prototype's sample replies quote a crop health, a mandi rate and a selling
 * recommendation that this build cannot actually know, and speaking them aloud
 * would be exactly the fabrication TRD §21 forbids.
 *
 * So the split is:
 *   - "How big is my field?"  → answered from the farmer's real saved farm.
 *   - everything else         → says plainly that the service is not connected.
 *
 * When Phases 2–5 land, each entry's `resolve` is replaced by a real backend
 * tool call and nothing else in the avatar changes.
 */

export const QUESTION_KEYS: QuestionKey[] = ['area', 'crop', 'mandi', 'sell', 'weather'];

export type ResolvedAnswer = {
  answer: string;
  source: string | null;
};

/** Prompt chips shown in the idle state. */
export function suggestionChips(t: TFunction): { key: QuestionKey; label: string }[] {
  return QUESTION_KEYS.map((key) => ({ key, label: t(`avatar.questions.${key}`) }));
}

export function questionText(t: TFunction, key: QuestionKey): string {
  return t(`avatar.questions.${key}`);
}

/**
 * Produce the answer for a question. `farm` is the farmer's real record — the
 * only live data the avatar has in Phase 1.
 */
export function resolveAnswer(
  t: TFunction,
  key: QuestionKey,
  farm: Farm | null,
): ResolvedAnswer {
  if (key === 'area') {
    if (!farm) {
      return { answer: t('avatar.answers.areaUnknown'), source: null };
    }
    return {
      answer: t('avatar.answers.area', {
        field: farm.name?.trim() || t('home.unnamedField'),
        acres: Number(farm.area_acres).toFixed(2),
      }),
      source: t('avatar.sources.field'),
    };
  }

  // Crop health, mandi rate, selling advice and weather all require services
  // that Phase 1 does not have. Say so rather than inventing a figure.
  return {
    answer: t(`avatar.answers.${key}`),
    source: t('avatar.sources.preview'),
  };
}

/**
 * Timings for the scripted listen → think → speak loop, matching the
 * prototype. Phase 5 replaces these with real recognition and inference
 * latency.
 */
export const DEMO_TIMINGS = {
  listeningMs: 1300,
  thinkingMs: 1200,
} as const;
