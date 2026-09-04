import { z } from 'zod';

/**
 * The avatar's request shapes.
 *
 * The history cap is a real constraint, not a formality: an unbounded history
 * is both a cost problem and a prompt-injection surface, since every turn is
 * farmer-supplied text that the model reads.
 */

const MAX_TURNS = 20;
const MAX_TURN_CHARS = 2000;

export const chatSchema = z
  .object({
    messages: z
      .array(
        z.object({
          role: z.enum(['user', 'model']),
          text: z.string().trim().min(1, 'A turn cannot be empty.').max(MAX_TURN_CHARS),
        }),
      )
      .min(1, 'Send at least one message.')
      .max(MAX_TURNS, `Keep the conversation under ${MAX_TURNS} turns.`),
    // Advisory only. The farmer's stored profile language is the fallback, and
    // the model is told to answer in whatever language it was addressed in.
    language: z.string().trim().max(10).optional(),
  })
  .strict()
  .refine((body) => body.messages.at(-1)?.role === 'user', {
    message: 'The last message must come from the farmer.',
  });

export type ChatBody = z.infer<typeof chatSchema>;

/**
 * What to say out loud.
 *
 * The cap matches the transcription-side limits in spirit: the app is meant to
 * send back an answer this API just produced, and anything longer than a
 * couple of paragraphs is not that.
 */
export const speakSchema = z
  .object({
    text: z.string().trim().min(1, 'There is nothing to say.').max(2000),
    language: z.string().trim().max(10).optional(),
  })
  .strict();

export type SpeakBody = z.infer<typeof speakSchema>;

export const transcribeSchema = z
  .object({
    language: z.string().trim().max(10).optional(),
  })
  .strict();

export const visualAskSchema = z
  .object({
    imageBase64: z.string().min(1, 'Missing imageBase64.'),
    mimeType: z.string().max(50).optional(),
    question: z.string().trim().max(2000).optional(),
    audioBase64: z.string().min(1).optional(),
    audioMimeType: z.string().max(50).optional(),
    language: z.string().trim().max(10).optional(),
  })
  .strict()
  .refine((data) => (data.question && data.question.length > 0) || Boolean(data.audioBase64), {
    message: 'Either question or audioBase64 must be provided.',
  });

export type VisualAskBody = z.infer<typeof visualAskSchema>;
