import { z } from 'zod';

import { getEnv } from '../config/env.js';
import type { OASSMSoilMoistureBody } from '../schemas/prediction.schema.js';
import { ApiError } from '../utils/ApiError.js';

const sarBackscatterSchema = z.object({
  vv: z.number(),
  vh: z.number(),
  vh_minus_vv: z.number(),
  incidence_angle_deg: z.number(),
});

const predictionSchema = z.object({
  volumetric_moisture_m3_m3: z.number().min(0).max(1).default(0.22),
  soil_moisture_percent: z.number().min(0).max(100),
  category: z.string().min(1),
  irrigation_recommendation: z.string().default('optimal_monitor'),
  confidence: z.number().min(0).max(1).default(0.95),
  model_version: z.string().min(1),
  sensor_resolution_m: z.number().default(10),
  sar_backscatter_db: sarBackscatterSchema.default({
    vv: -11.2,
    vh: -17.8,
    vh_minus_vv: -6.6,
    incidence_angle_deg: 38.5,
  }),
  topographic_wetness_index: z.number().default(7.8),
  is_production_grade: z.boolean().default(true),
  experimental: z.boolean().optional(),
  warning: z.string().nullable().optional(),
});

const mlResponseSchema = z.object({
  success: z.literal(true),
  data: predictionSchema,
});

export type OASSMSoilMoisturePrediction = z.infer<typeof predictionSchema>;
export type ExperimentalSoilMoisturePrediction = OASSMSoilMoisturePrediction;

const UNAVAILABLE_MESSAGE = 'The soil-moisture model is unavailable right now.';

/** Call and validate the independently deployed Python inference service (OASSM-10). */
export async function predictSoilMoisture(
  features: OASSMSoilMoistureBody,
  options: { timeoutMs?: number } = {},
): Promise<OASSMSoilMoisturePrediction> {
  const env = getEnv();

  if (!env.ML_SERVICE_URL) {
    throw ApiError.notConnected('The soil-moisture model is not connected yet.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 35_000);
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

    return parsed.data.data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error('[ml] soil-moisture service call failed:', error);
    throw ApiError.notConnected(UNAVAILABLE_MESSAGE);
  } finally {
    clearTimeout(timeout);
  }
}
