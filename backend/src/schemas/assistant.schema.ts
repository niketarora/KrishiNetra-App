import { z } from 'zod';

/**
 * What the guide accepts.
 *
 * A single transcript rather than a history array, unlike `chatSchema`. The
 * guide routes one request at a time, and conversational memory belongs to the
 * branch that needs it — the farming agent keeps its own thread keyed on the
 * farmer — rather than being re-sent from the device on every turn.
 */
export const assistSchema = z
  .object({
    transcript: z.string().trim().min(1, 'There is nothing to act on.').max(2000),
    // Advisory only. The farmer's stored profile language is the fallback.
    language: z.string().trim().max(10).optional(),
  })
  .strict();

export type AssistBody = z.infer<typeof assistSchema>;
