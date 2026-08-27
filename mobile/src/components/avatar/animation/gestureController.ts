import type { AvatarGesture } from './animationController';

/**
 * Picks the gesture that punctuates a spoken answer.
 *
 * §7: "Do not make gestures fully random." Random gesturing reads as a broken
 * puppet — the hands contradict the words. So the gesture is chosen from the
 * *content* of the reply, deterministically: the same answer always produces
 * the same gesture, and a farmer who asks the same question twice does not see
 * the avatar behave differently for no reason.
 *
 * This is shallow text matching, not understanding, and it is meant to be. The
 * language model is never asked what to do with the body (§5).
 */

/**
 * Ordered: the first match wins, so the more specific cues are checked before
 * the general ones.
 */
const CUES: { gesture: AvatarGesture; patterns: RegExp[] }[] = [
  {
    // Anything the assistant cannot do. An open, empty hand is the honest
    // shape for "I don't have that" — never a confident pointing gesture.
    gesture: 'open_hand',
    patterns: [
      /not connected/i,
      /cannot|can't|can not/i,
      /don't have|do not have/i,
      /नहीं जुड़/,
      /नहीं बता/,
    ],
  },
  {
    gesture: 'greeting',
    patterns: [/^(namaste|hello|hi\b|good (morning|afternoon|evening))/i, /^नमस्ते/],
  },
  {
    gesture: 'agree',
    patterns: [/^(yes|yes,|correct|that's right|indeed)/i, /^(हाँ|जी हाँ)/],
  },
  {
    // A figure being quoted: a price, an area, a temperature. Pointing marks
    // the number as the thing being referred to.
    gesture: 'point',
    patterns: [/₹\s?\d/, /\d+(\.\d+)?\s?(acres|quintal|°c|mm|%)/i, /\d+(\.\d+)?\s?(एकड़|क्विंटल)/],
  },
];

/** The gesture for one spoken reply. Deterministic for a given text. */
export function gestureForReply(reply: string): AvatarGesture {
  const text = reply.trim();
  if (text === '') return 'none';

  for (const { gesture, patterns } of CUES) {
    if (patterns.some((pattern) => pattern.test(text))) return gesture;
  }

  // A plain informative answer. `explain` is the neutral talking gesture.
  return 'explain';
}

/**
 * How long a reply should keep gesturing, in milliseconds.
 *
 * Derived from reading speed so the hands stop roughly when the sentence would
 * end. Clamped so a one-word answer still gets a beat and a long one does not
 * gesticulate indefinitely.
 */
export function gestureDurationMs(reply: string): number {
  const words = reply.trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return 0;

  // ~150 words per minute is unhurried speech, which is what a farmer needs.
  const estimated = (words / 150) * 60_000;
  return Math.min(Math.max(estimated, 1200), 12_000);
}
