import { z } from 'zod';

import { getEnv } from '../config/env.js';
import type { ExperimentalSoilMoistureBody } from '../schemas/prediction.schema.js';
import { ApiError } from '../utils/ApiError.js';

const predictionSchema = z
  .object({
    soil_moisture_percent: z.number().min(0).max(100),
    category: z.string().min(1),
    model_version: z.string().min(1),
    production_ready: z.boolean(),
    experimental: z.boolean(),
    recommendation: z.null(),
    warning: z.string().min(1),
  })
  .strict();

const mlResponseSchema = z
  .object({
    success: z.literal(true),
    data: predictionSchema,
  })
  .strict();

export type ExperimentalSoilMoisturePrediction = z.infer<typeof predictionSchema>;

const UNAVAILABLE_MESSAGE = 'The soil-moisture model is unavailable right now.';

/** Call and validate the independently deployed Python inference service. */
export async function predictSoilMoisture(
  features: ExperimentalSoilMoistureBody,
  options: { timeoutMs?: number } = {},
): Promise<ExperimentalSoilMoisturePrediction> {
  const env = getEnv();

  if (!env.ML_SERVICE_URL) {
    throw ApiError.notConnected('The soil-moisture model is not connected yet.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 10_000);
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  if (env.ML_SERVICE_API_KEY) headers['X-Internal-Key'] = env.ML_SERVICE_API_KEY;

  try {
    const baseUrl = env.ML_SERVICE_URL.replace(/\/+$/, '');
    const response = await fetch(`${baseUrl}/predict/soil-moisture`, {
      method: 'POST',
      headers,
      body: JSON.stringify(features),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error(`[ml] soil-moisture service returned HTTP ${response.status}`);
      throw ApiError.notConnected(UNAVAILABLE_MESSAGE);
    }

    const parsed = mlResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      console.error('[ml] soil-moisture service returned an invalid response', parsed.error.issues);
      throw ApiError.notConnected(UNAVAILABLE_MESSAGE);
    }

    // Do not let an unapproved artifact appear production-ready or become
    // irrigation advice merely because a downstream response drifted.
    if (!parsed.data.data.experimental || parsed.data.data.production_ready) {
      console.error('[ml] soil-moisture artifact safety flags violated the experimental contract');
      throw ApiError.notConnected(UNAVAILABLE_MESSAGE);
    }

    return parsed.data.data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error('[ml] soil-moisture service call failed:', error);
    throw ApiError.notConnected(UNAVAILABLE_MESSAGE);
  } finally {
    clearTimeout(timeout);
  }
}
