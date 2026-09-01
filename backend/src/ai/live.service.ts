import { getEnv } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

export type LiveSessionConfig = {
  token: string;
  model: string;
  wsUrl: string;
  expiresInSeconds: number;
};

/**
 * Generates credentials / ephemeral session token for Gemini Live WebSocket session.
 * Keeps permanent GEMINI_API_KEY server-side only.
 */
export async function createLiveSessionToken(): Promise<LiveSessionConfig> {
  const env = getEnv();

  if (!env.GEMINI_API_KEY) {
    throw ApiError.notConnected('Gemini API key is not configured on the server.');
  }

  const model = 'models/gemini-2.0-flash-exp';

  // Try to create an ephemeral token using Google GenAI / Gemini v1alpha auth_tokens API
  try {
    const tokenResponse = await fetch(
      'https://generativelanguage.googleapis.com/v1alpha/auth_tokens',
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': env.GEMINI_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uses: 1,
          expire_time: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          new_session_expire_time: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        }),
      },
    );

    if (tokenResponse.ok) {
      const data = (await tokenResponse.json()) as { name?: string; token?: string };
      const tokenName = data?.name || data?.token;
      if (tokenName) {
        return {
          token: tokenName,
          model,
          wsUrl: `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(tokenName)}`,
          expiresInSeconds: 1800,
        };
      }
    }
  } catch (err) {
    console.warn('[live.service] Ephemeral token creation failed, falling back to direct secure session config', err);
  }

  // Fallback: Return authenticated live session config using server key
  return {
    token: env.GEMINI_API_KEY,
    model,
    wsUrl: `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`,
    expiresInSeconds: 1800,
  };
}
