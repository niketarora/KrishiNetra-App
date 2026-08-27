import { GoogleGenAI, ThinkingLevel } from '@google/genai';

import { getEnv } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

import { buildSystemPrompt, type FarmerContext } from './prompt.js';

/**
 * The avatar's language model, behind one adapter.
 *
 * Only this file knows which provider is in use. The controller, the mobile
 * app and the prompt builder are all provider-agnostic, so swapping Gemini for
 * something else touches this file alone.
 *
 * The API key lives here, server-side, and never reaches the app — TRD §22 and
 * §10 of the phase document both require it.
 */

export type ChatTurn = {
  role: 'user' | 'model';
  text: string;
};

export type ChatReply = {
  text: string;
  model: string;
};

/** Keeps one client rather than rebuilding it per request. */
let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  const env = getEnv();

  if (!env.GEMINI_API_KEY) {
    // Not a crash: the rest of the API works fine without an LLM key, and the
    // avatar reports itself as unavailable rather than the server dying.
    throw ApiError.notConnected('The assistant is not connected yet.');
  }

  client ??= new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  return client;
}

/** Test seam, mirroring resetEnvCache. */
export function resetLlmClient(): void {
  client = null;
}

/**
 * Ask the model for a reply.
 *
 * `history` is the conversation so far and `context` is what the API already
 * retrieved about this farmer. The two are kept separate on purpose: history is
 * farmer-supplied text, context is verified data, and only context may be
 * treated as fact.
 */
export async function chat(
  history: ChatTurn[],
  context: FarmerContext,
  options: { timeoutMs?: number } = {},
): Promise<ChatReply> {
  const env = getEnv();
  const ai = getClient();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 20_000);

  try {
    const response = await ai.models.generateContent({
      model: env.GEMINI_MODEL,
      contents: history.map((turn) => ({
        role: turn.role,
        parts: [{ text: turn.text }],
      })),
      config: {
        systemInstruction: buildSystemPrompt(context),
        // The reply is spoken aloud, so a long one is a worse answer. This is a
        // ceiling, not a target; the prompt asks for two or three sentences.
        maxOutputTokens: 400,
        // Low but not zero: the farmer may rephrase a question and deserves a
        // differently-worded answer, but this is not a creative writing task.
        temperature: 0.4,
        // A farmer is waiting to hear this. Thinking would add seconds for no
        // benefit — the model is not reasoning, it is relaying given facts.
        // Gemini 3 models reject thinkingBudget with a 400; 'minimal' is how
        // they express the same intent.
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        abortSignal: controller.signal,
      },
    });

    const text = response.text?.trim();

    if (!text) {
      // An empty completion, a safety block, or a truncated response. Any reply
      // we synthesised here would be words the model never said.
      throw ApiError.notConnected('The assistant could not answer that. Please try again.');
    }

    return { text, model: env.GEMINI_MODEL };
  } catch (error) {
    if (error instanceof ApiError) throw error;

    // The provider's own error text can name the model, quote the key's
    // permissions, or carry a request id. None of that reaches the farmer.
    console.error('[llm] provider call failed:', error);
    throw ApiError.notConnected('The assistant is unavailable right now.');
  } finally {
    clearTimeout(timeout);
  }
}
