import type { Request, Response } from 'express';

import { buildFarmerContext } from '../ai/context.service.js';
import { chat as askModel } from '../ai/llm.service.js';
import { transcribe as runTranscription } from '../ai/stt.service.js';
import { synthesize } from '../ai/tts.service.js';
import { getAuth } from '../middleware/requireAuth.js';
import type { ChatBody, SpeakBody } from '../schemas/ai.schema.js';
import { ApiError } from '../utils/ApiError.js';
import { sendOk } from '../utils/apiResponse.js';

/**
 * The avatar's three endpoints: ear, brain and voice.
 *
 * Every provider key stays on this side of the wire. The app sends audio and
 * text and receives text and audio; it never learns which provider answered,
 * which is what lets Phase 5 replace the whole thing behind these routes.
 */

/** Upload cap. A spoken question is seconds long; anything larger is not one. */
export const MAX_AUDIO_BYTES = 8 * 1024 * 1024;

export async function transcribe(req: Request, res: Response): Promise<void> {
  getAuth(req);

  const file = req.file;
  if (!file) throw ApiError.invalidRequest('No audio was uploaded.');

  const { language } = req.body as { language?: string };

  const result = await runTranscription(
    {
      buffer: file.buffer,
      filename: file.originalname || 'speech.m4a',
      mimeType: file.mimetype || 'audio/m4a',
    },
    language,
  );

  sendOk(res, result, 'Transcribed');
}

export async function chat(req: Request, res: Response): Promise<void> {
  const { token, userId } = getAuth(req);
  const body = req.body as ChatBody;

  // Read the farmer's own records first, so the model answers from facts
  // rather than from whatever the conversation has claimed so far.
  const context = await buildFarmerContext(token, userId);

  if (body.language) context.language = body.language;

  const reply = await askModel(
    body.messages.map((message) => ({ role: message.role, text: message.text })),
    context,
  );

  sendOk(res, reply, 'Replied');
}

/**
 * Read an answer aloud.
 *
 * Kept separate from `chat` rather than folded into it, for two reasons. The
 * suggestion chips produce an answer the farmer never spoke for, and it should
 * still be read out; and when the voice fails the answer is already on screen,
 * so the app can lose the audio without losing the reply.
 */
export async function speak(req: Request, res: Response): Promise<void> {
  getAuth(req);

  const body = req.body as SpeakBody;
  const speech = await synthesize(body.text, body.language);

  sendOk(res, speech, 'Spoken');
}
