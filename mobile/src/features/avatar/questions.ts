import type { TFunction } from 'i18next';

import type { QuestionKey } from './avatarMachine';

/**
 * The suggestion chips shown while the avatar is idle.
 *
 * These were the Phase 1 "demo script", which paired each question with a
 * hard-coded answer. Phase 2.5 deleted the answers: the questions now go to the
 * real assistant, which replies from the farmer's own records or says plainly
 * that the service is not connected.
 *
 * They survive as chips because a farmer facing a microphone needs to know
 * what they are allowed to ask, and because they are still the five things the
 * prototype identified as most useful.
 */

export const QUESTION_KEYS: QuestionKey[] = ['area', 'crop', 'mandi', 'sell', 'weather'];

export function suggestionChips(t: TFunction): { key: QuestionKey; label: string }[] {
  return QUESTION_KEYS.map((key) => ({ key, label: t(`avatar.questions.${key}`) }));
}

export function questionText(t: TFunction, key: QuestionKey): string {
  return t(`avatar.questions.${key}`);
}
