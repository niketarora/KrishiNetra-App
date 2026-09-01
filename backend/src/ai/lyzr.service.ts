import { getEnv } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

import { buildContextBlock, describeLanguage, type FarmerContext } from './prompt.js';

/**
 * The farming expert, behind one adapter.
 *
 * Questions about agronomy — pests, disease, soil, technique — go here rather
 * than to the general model, because the agent on the other side is configured
 * for exactly that and keeps its own thread per farmer.
 *
 * What it is *given* still comes from here, though. The farmer's verified
 * records are serialised with `buildContextBlock` — the same tested function
 * the general assistant uses — so an agent answering "should I spray my wheat"
 * knows what is actually sown, and there is only one place in the codebase
 * that decides how a farmer's data is described to a model.
 */

/**
 * Read the agent's reply back.
 *
 * Lyzr has spelled this field differently across API versions, so all the
 * plausible names are accepted rather than pinning the adapter to one and
 * having it return silence after an upgrade.
 */
export function parseLyzrReply(payload: unknown): string | null {
  if (typeof payload === 'string') return payload.trim() || null;
  if (!payload || typeof payload !== 'object') return null;

  const record = payload as Record<string, unknown>;

  for (const key of ['response', 'answer', 'message', 'output', 'text']) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }

  return null;
}

/**
 * The conversation thread for one farmer.
 *
 * Lyzr's own session ids look like `<agent_id>-<suffix>`, so that shape is
 * followed rather than invented around. The suffix is the farmer's id, which
 * is what gives each farmer one continuous thread instead of a cold start on
 * every question — a farmer who says "and what about the other field?" is
 * understood.
 */
export function sessionIdFor(agentId: string, farmerId: string): string {
  return `${agentId}-${farmerId}`;
}

/**
 * Ask the farming agent.
 *
 * Note which identifier goes where, because the two are easy to swap and the
 * failure is silent. `user_id` is the *Lyzr account* the agent belongs to — an
 * email, fixed for this deployment. The farmer is identified only by
 * `session_id`. Sending a farmer's id as `user_id` addresses an account that
 * does not exist.
 */
export async function askExpert(
  transcript: string,
  context: FarmerContext,
  farmerId: string,
  options: { timeoutMs?: number } = {},
): Promise<{ text: string }> {
  const env = getEnv();

  if (!env.LYZR_API_KEY || !env.LYZR_AGENT_ID || !env.LYZR_USER_ID) {
    throw ApiError.notConnected('The farming expert is not connected yet.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 20_000);

    const langName = context.language ? describeLanguage(context.language) : null;
    const langInstruction = langName
      ? `Reply strictly in ${langName} (${context.language}) using its native script (e.g. Devanagari script for Hindi). Do not reply in English unless the question was in English.`
      : '';

    const message = [
      buildContextBlock(context),
      '',
      `The farmer asks: ${transcript}`,
      '',
      // The same discipline the in-house prompt enforces (prompt.ts §CRITICAL
      // RULES). An external agent has no idea which numbers it may quote at this
      // farmer, so it is told, every time.
      'Answer in two or three short sentences, in plain spoken language, with no',
      'markdown, bullets or emoji. Only quote figures listed above; if you do not',
      'have a figure, say so rather than estimating one.',
      langInstruction,
    ]
    .filter(Boolean)
    .join('\n');

  try {
    const response = await fetch(env.LYZR_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': env.LYZR_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: env.LYZR_USER_ID,
        agent_id: env.LYZR_AGENT_ID,
        session_id: sessionIdFor(env.LYZR_AGENT_ID, farmerId),
        message,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      // Status only — the provider's body can name the agent and the key.
      console.error('[lyzr] agent call failed with status', response.status);
      throw ApiError.notConnected('The farming expert is unavailable right now.');
    }

    const text = parseLyzrReply(await response.json());
    if (!text) {
      throw ApiError.notConnected('The farming expert could not answer that. Please try again.');
    }

    return { text };
  } catch (error) {
    if (error instanceof ApiError) throw error;

    console.error('[lyzr] agent call failed:', error);
    throw ApiError.notConnected('The farming expert is unavailable right now.');
  } finally {
    clearTimeout(timeout);
  }
}
