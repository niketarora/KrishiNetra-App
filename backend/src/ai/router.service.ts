import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

import { getEnv } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

import { destinationCatalogue, matchDestinationLocally } from './navigationRegistry.js';

/**
 * The fast classifier every request passes through.
 *
 * Its only job is to decide which of three destinations a spoken request
 * belongs to, and to pull out the entities that destination needs. It does not
 * answer anything, does not see the farmer's records, and never emits UI
 * commands — deliberately, because this is the one call on the hot path and
 * everything it is asked to do is latency the farmer waits through.
 *
 * Hence the tuning below: zero temperature, a 96-token ceiling, minimal
 * thinking, a schema-constrained response, and an 8-second deadline that is
 * shorter than any other AI call in the codebase. A router that takes as long
 * as the answer would defeat the point of having one.
 */

export type Intent = 'APP_NAVIGATION' | 'FARMING_EXPERT' | 'DEEP_RESEARCH';

export type RouterResult = {
  intent: Intent;
  /** A registry destination id when the intent is APP_NAVIGATION. */
  target: string | null;
  entities: Record<string, string>;
};

const INTENTS: readonly Intent[] = ['APP_NAVIGATION', 'FARMING_EXPERT', 'DEEP_RESEARCH'];

/** Keeps one client rather than rebuilding it per request. */
let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  const env = getEnv();

  if (!env.GEMINI_API_KEY) {
    throw ApiError.notConnected('The assistant is not connected yet.');
  }

  client ??= new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  return client;
}

/** Test seam, mirroring resetLlmClient. */
export function resetRouterClient(): void {
  client = null;
}

/**
 * Read the model's JSON back.
 *
 * Tolerant on shape, strict on values: an unrecognised intent is rejected
 * outright rather than coerced to a default, because guessing here sends the
 * farmer's question down the wrong pipeline entirely.
 */
export function parseRouterOutput(payload: unknown): RouterResult | null {
  if (!payload || typeof payload !== 'object') return null;

  const record = payload as Record<string, unknown>;
  const intent = typeof record.intent === 'string' ? record.intent.trim().toUpperCase() : null;

  if (!intent || !INTENTS.includes(intent as Intent)) return null;

  const rawTarget = record.target;
  const target =
    typeof rawTarget === 'string' && rawTarget.trim() && rawTarget.trim().toLowerCase() !== 'null'
      ? rawTarget.trim().toLowerCase()
      : null;

  const entities: Record<string, string> = {};
  if (record.entities && typeof record.entities === 'object') {
    for (const [key, value] of Object.entries(record.entities as Record<string, unknown>)) {
      // Only scalars survive. The consumers of this treat entities as short
      // labels (a land name, a crop, a state), never as structured data.
      if (typeof value === 'string' && value.trim()) entities[key] = value.trim();
      else if (typeof value === 'number' || typeof value === 'boolean') entities[key] = String(value);
    }
  }

  return { intent: intent as Intent, target, entities };
}

function buildRouterPrompt(): string {
  return [
    'You are the intent router for KrishiNetra, a farming app used by farmers in India.',
    'Classify the farmer\'s spoken request into exactly one intent. Answer with JSON only.',
    '',
    'APP_NAVIGATION — the farmer wants to reach or see something that is already in',
    'this app. Asking where something is, to open a screen, or to be shown their own',
    'recorded data. Set "target" to one of the destination ids below.',
    '',
    'FARMING_EXPERT — a farming knowledge question that does not depend on current',
    'events: agronomy, pests, disease symptoms, soil, seed, technique, timing.',
    'Set "target" to null.',
    '',
    'DEEP_RESEARCH — the answer needs current information from outside this app:',
    'government schemes and subsidies, new policy, news, prices in other states,',
    'anything where "latest" or "this year" matters. Set "target" to null, and set',
    'entities.depth to "deep" only when the question genuinely needs several sources',
    'compared; otherwise leave it out.',
    '',
    'Destination ids for APP_NAVIGATION:',
    destinationCatalogue(),
    '',
    'Also extract entities when the farmer named one: landName, crop, state, district.',
    'Do not invent them. Omit anything the farmer did not say.',
    '',
    'When the request could be either, prefer APP_NAVIGATION if the farmer is asking',
    'WHERE something is or to be SHOWN their own data, and FARMING_EXPERT if they are',
    'asking WHAT to do about a farming problem.',
  ].join('\n');
}

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    intent: { type: Type.STRING, enum: [...INTENTS] },
    target: { type: Type.STRING, nullable: true },
    entities: {
      type: Type.OBJECT,
      properties: {
        landName: { type: Type.STRING, nullable: true },
        crop: { type: Type.STRING, nullable: true },
        state: { type: Type.STRING, nullable: true },
        district: { type: Type.STRING, nullable: true },
        depth: { type: Type.STRING, nullable: true },
      },
    },
  },
  required: ['intent'],
} as const;

/**
 * Classify one transcript.
 *
 * The local alias match runs first and, when it hits, returns without touching
 * the model at all — the repeat navigation requests that make up most of the
 * traffic then cost zero AI latency.
 */
export async function classify(
  transcript: string,
  language: string | undefined,
  options: { timeoutMs?: number } = {},
): Promise<RouterResult> {
  const local = matchDestinationLocally(transcript);
  if (local) {
    return { intent: 'APP_NAVIGATION', target: local.id, entities: {} };
  }

  const env = getEnv();
  const ai = getClient();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000);

  try {
    const response = await ai.models.generateContent({
      model: env.GEMINI_ROUTER_MODEL || env.GEMINI_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: language
                ? `Farmer's language: ${language}\nRequest: ${transcript}`
                : `Request: ${transcript}`,
            },
          ],
        },
      ],
      config: {
        systemInstruction: buildRouterPrompt(),
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        // Classification, not composition. The same request must route the same
        // way every time or the app becomes unpredictable to learn.
        temperature: 0,
        maxOutputTokens: 96,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        abortSignal: controller.signal,
      },
    });

    const text = response.text?.trim();
    if (!text) throw ApiError.notConnected('The assistant could not understand that.');

    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }

    const result = parseRouterOutput(payload);

    // A router that cannot classify sends the request to the expert rather than
    // failing it. The farmer asked a real question either way, and the farming
    // agent is the branch most likely to have something useful to say about it.
    return result ?? { intent: 'FARMING_EXPERT', target: null, entities: {} };
  } catch (error) {
    if (error instanceof ApiError) throw error;

    console.error('[router] classification failed:', error);
    throw ApiError.notConnected('The assistant is unavailable right now.');
  } finally {
    clearTimeout(timeout);
  }
}
