/**
 * The AI Farmer Avatar's state machine.
 *
 * This is deliberately a pure reducer: no timers, no audio, no network, no
 * knowledge of where answers come from. Phase 1 drives it from a scripted
 * demo; Phase 5 will drive the identical transitions from speech-to-text, an
 * LLM agent and text-to-speech. Swapping the driver must not require touching
 * this file or any avatar component.
 */

export type AvatarState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

/** Identifies which scripted exchange is in play. */
export type QuestionKey = 'area' | 'crop' | 'mandi' | 'sell' | 'weather';

export type AvatarContent = {
  /** What the farmer asked, once a question is in play. */
  question: QuestionKey | null;
  /** The answer text to show while speaking. */
  answer: string | null;
  /**
   * Where the answer came from. Answers about live prices, weather or
   * predictions must always carry a source — TRD §21 forbids the assistant
   * presenting unverified values as fact.
   */
  source: string | null;
};

export type AvatarMachineState = AvatarContent & {
  state: AvatarState;
};

export type AvatarEvent =
  /** The farmer started speaking, or tapped a suggested question. */
  | { type: 'START_LISTENING'; question?: QuestionKey }
  /** The farmer finished speaking; the answer is being worked out. */
  | { type: 'STOP_LISTENING' }
  /** An answer is ready and is now being spoken. */
  | { type: 'RESOLVE'; answer: string; source: string | null }
  /** Audio, recognition or retrieval failed. */
  | { type: 'FAIL' }
  /** Speaking finished naturally. */
  | { type: 'DONE' }
  /** Back to a clean idle state, e.g. when the overlay is closed. */
  | { type: 'RESET' };

export const initialAvatarState: AvatarMachineState = {
  state: 'idle',
  question: null,
  answer: null,
  source: null,
};

export function avatarReducer(
  current: AvatarMachineState,
  event: AvatarEvent,
): AvatarMachineState {
  switch (event.type) {
    case 'START_LISTENING':
      // Reachable from every state — the farmer may interrupt an answer to ask
      // something else, which the design explicitly invites ("Ask a follow-up").
      return {
        state: 'listening',
        question: event.question ?? current.question,
        answer: null,
        source: null,
      };

    case 'STOP_LISTENING':
      if (current.state !== 'listening') return current;
      return { ...current, state: 'thinking', answer: null, source: null };

    case 'RESOLVE':
      // Only a pending question can be answered; a stray resolve is ignored so
      // a late response can never speak over an idle or errored avatar.
      if (current.state !== 'thinking') return current;
      return { ...current, state: 'speaking', answer: event.answer, source: event.source };

    case 'FAIL':
      if (current.state === 'idle') return current;
      return { ...current, state: 'error', answer: null, source: null };

    case 'DONE':
      if (current.state !== 'speaking') return current;
      return { ...current, state: 'idle' };

    case 'RESET':
      return initialAvatarState;

    default:
      return current;
  }
}

/** States where the waveform animates — the farmer or the avatar has the floor. */
export function isAudioActive(state: AvatarState): boolean {
  return state === 'listening' || state === 'speaking';
}
