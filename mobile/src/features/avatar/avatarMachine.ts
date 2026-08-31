import type { AssistantResponse } from '@/services/assistantService';

/**
 * The AI Farmer Avatar's state machine.
 *
 * Still a pure reducer: no timers, no audio, no network, no navigation. It does
 * not know that answers now come from three different places, and it must not —
 * the driver changed from a scripted demo to a real voice loop without this
 * file being touched, and the same has to hold the next time.
 *
 * One state was added for the guide. `guiding` is what the avatar is doing
 * while the app is moving underneath it: the answer has arrived, the farmer is
 * being taken somewhere, and the avatar is talking them through it. It is
 * separate from `speaking` because the two end differently — speech finishes
 * on its own, a guide finishes when the last step has been performed.
 */

export type AvatarState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'guiding' | 'error';

/** Identifies which scripted exchange is in play. */
export type QuestionKey = 'area' | 'crop' | 'mandi' | 'sell' | 'weather';

export type AvatarContent = {
  /** What the farmer asked, once a question is in play. */
  question: QuestionKey | null;
  /** The transcript of what the farmer actually said, once recognised. */
  transcript: string | null;
  /**
   * What came back, whole. The components read `type` off this to decide
   * whether to show sources, and the driver reads `navigation` off it to run
   * the guide — neither needs the reducer to understand either.
   */
  response: AssistantResponse | null;
};

export type AvatarMachineState = AvatarContent & {
  state: AvatarState;
};

export type AvatarEvent =
  /** The farmer started speaking, or tapped a suggested question. */
  | { type: 'START_LISTENING'; question?: QuestionKey }
  /** The farmer finished speaking; the request is being routed. */
  | { type: 'STOP_LISTENING'; transcript?: string }
  /** An answer is ready. The avatar shows it and starts speaking. */
  | { type: 'RESOLVE'; response: AssistantResponse }
  /** The app has started moving; the avatar is narrating the journey. */
  | { type: 'GUIDE_STARTED' }
  /** Audio, recognition or routing failed. */
  | { type: 'FAIL' }
  /** Speaking, and any guidance, finished. */
  | { type: 'DONE' }
  /** Back to a clean idle state. */
  | { type: 'RESET' };

export const initialAvatarState: AvatarMachineState = {
  state: 'idle',
  question: null,
  transcript: null,
  response: null,
};

export function avatarReducer(
  current: AvatarMachineState,
  event: AvatarEvent,
): AvatarMachineState {
  switch (event.type) {
    case 'START_LISTENING':
      // Reachable from every state — the farmer may interrupt an answer, or a
      // guide in progress, to ask something else. The design explicitly invites
      // that, and the driver cancels the abandoned run rather than the reducer
      // refusing the event.
      return {
        state: 'listening',
        question: event.question ?? current.question,
        transcript: null,
        response: null,
      };

    case 'STOP_LISTENING':
      if (current.state !== 'listening') return current;
      return {
        ...current,
        state: 'thinking',
        transcript: event.transcript ?? null,
        response: null,
      };

    case 'RESOLVE':
      // Only a pending request can be answered; a stray resolve is ignored so a
      // late response can never speak over an idle or errored avatar.
      if (current.state !== 'thinking') return current;
      return { ...current, state: 'speaking', response: event.response };

    case 'GUIDE_STARTED':
      // Guidance begins while the avatar is still speaking, by design — the app
      // moves as the sentence starts rather than after it ends.
      if (current.state !== 'speaking') return current;
      return { ...current, state: 'guiding' };

    case 'FAIL':
      if (current.state === 'idle') return current;
      return { ...current, state: 'error', response: null };

    case 'DONE':
      if (current.state !== 'speaking' && current.state !== 'guiding') return current;
      return { ...current, state: 'idle' };

    case 'RESET':
      return initialAvatarState;

    default:
      return current;
  }
}

/** States where the waveform animates — the farmer or the avatar has the floor. */
export function isAudioActive(state: AvatarState): boolean {
  return state === 'listening' || state === 'speaking' || state === 'guiding';
}

/** States where the avatar should be visible on screen. */
export function isAvatarVisible(state: AvatarState): boolean {
  return state !== 'idle';
}
