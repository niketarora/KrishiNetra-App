import type { AvatarState } from '@/features/avatar/avatarMachine';

/**
 * Decides what the avatar's body should be doing, from the state machine alone.
 *
 * The plan put these controllers inside the WebView. They live here instead so
 * they can be unit tested, and because the split turns out cleaner: this module
 * makes the *decisions* (which clip, which gesture, how much mouth movement),
 * and the scene executes them and owns the per-frame work — breathing, blinking,
 * interpolation. Nothing crosses the bridge per frame; a directive is sent only
 * when the state changes.
 *
 * The language model never touches any of this. §5 of the phase document is
 * explicit: the LLM's output is data, and a deterministic controller owns every
 * animation decision. Asking the model to emit `move_head` would make the
 * avatar's body another thing it could hallucinate.
 */

/** The clip set the model is expected to provide. */
export type AvatarClip = 'idle' | 'listening' | 'thinking' | 'talking';

/** §7's gesture library. */
export type AvatarGesture =
  | 'none'
  | 'idle'
  | 'explain'
  | 'agree'
  | 'thinking'
  | 'greeting'
  | 'open_hand'
  | 'point';

export type AvatarExpression = 'neutral' | 'attentive' | 'thoughtful' | 'speaking' | 'concerned';

export type SceneDirective = {
  clip: AvatarClip;
  gesture: AvatarGesture;
  expression: AvatarExpression;
  /**
   * How much the jaw should move, 0–1.
   *
   * This is NOT lip sync. There is no audio and no viseme timing in this phase
   * (§6), so the scene oscillates the jaw at a speaking cadence. When TTS
   * arrives, `lipSyncController` replaces this number with real viseme frames
   * and nothing else here changes.
   */
  mouthActivity: number;
  /** Head motion amplitude, 0–1. Subtle everywhere — §7 asks for small moves. */
  headMotion: number;
  /** Blinks per minute. Humans average 15–20 at rest, fewer when concentrating. */
  blinkRate: number;
};

const DIRECTIVES: Record<AvatarState, SceneDirective> = {
  idle: {
    clip: 'idle',
    gesture: 'idle',
    expression: 'neutral',
    mouthActivity: 0,
    headMotion: 0.15,
    blinkRate: 17,
  },
  listening: {
    // Attentive and still. A listener who gestures is not listening.
    clip: 'listening',
    gesture: 'none',
    expression: 'attentive',
    mouthActivity: 0,
    headMotion: 0.25,
    blinkRate: 12,
  },
  thinking: {
    clip: 'thinking',
    gesture: 'thinking',
    expression: 'thoughtful',
    mouthActivity: 0,
    // People blink less while concentrating, and it reads as concentration.
    headMotion: 0.35,
    blinkRate: 8,
  },
  speaking: {
    clip: 'talking',
    gesture: 'explain',
    expression: 'speaking',
    mouthActivity: 0.85,
    headMotion: 0.5,
    blinkRate: 20,
  },
  error: {
    // Reassuring, not alarmed. The error is the UI's job to explain; the
    // avatar's job is to not look like it broke.
    clip: 'idle',
    gesture: 'open_hand',
    expression: 'concerned',
    mouthActivity: 0,
    headMotion: 0.2,
    blinkRate: 15,
  },
};

export function directiveFor(state: AvatarState): SceneDirective {
  return DIRECTIVES[state];
}

/**
 * Reduce-motion strips the idling life out of the avatar without hiding it.
 *
 * `AvatarStage` already honours this setting for its breathing loop, and the
 * 3D avatar has to obey the same preference or the accessibility setting only
 * half works.
 */
export function stillDirective(state: AvatarState): SceneDirective {
  return {
    ...directiveFor(state),
    gesture: 'none',
    mouthActivity: 0,
    headMotion: 0,
    blinkRate: 0,
  };
}

export function resolveDirective(state: AvatarState, reduceMotion: boolean): SceneDirective {
  return reduceMotion ? stillDirective(state) : directiveFor(state);
}
