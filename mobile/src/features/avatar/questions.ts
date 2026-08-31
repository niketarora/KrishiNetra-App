import type { TFunction } from 'i18next';

import type { QuestionKey } from './avatarMachine';

/**
 * The five canned questions.
 *
 * These were the Phase 1 "demo script", which paired each question with a
 * hard-coded answer. Phase 2.5 deleted the answers: the questions now go to the
 * real assistant, which replies from the farmer's own records or says plainly
 * that the service is not connected.
 *
 * The idle suggestion chips they used to fill are gone with the full-screen
 * overlay — the corner guide has no idle state to put them in, because it is
 * hidden until it has something to say. `questionText` remains as the way a
 * tapped question enters the pipeline: `AvatarContext.ask` routes it exactly as
 * a spoken one, so any surface that wants to offer a shortcut still can.
 */

export const QUESTION_KEYS: QuestionKey[] = ['area', 'crop', 'mandi', 'sell', 'weather'];

export function questionText(t: TFunction, key: QuestionKey): string {
  return t(`avatar.questions.${key}`);
}
