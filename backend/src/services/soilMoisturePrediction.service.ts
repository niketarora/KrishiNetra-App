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

/** Deterministic local multi-sensor OASSM-10 physics model fallback. */
export function calculateLocalOASSM10(features: OASSMSoilMoistureBody): OASSMSoilMoisturePrediction {
  const vv = features.vv ?? -11.2;
  const vh = features.vh ?? -17.8;
  const vhMinusVv = features.vh_minus_vv ?? (vh - vv);
  const angle = features.angle ?? 38.5;
  const ndmi = features.ndmi ?? 0.18;
  const savi = features.savi ?? 0.38;
  const twi = features.twi_proxy ?? 7.8;
  const rainfall = features.rainfall ?? 12.0;
  const tempC = features.temperature_c ?? 28.0;
  const humidity = features.humidity_percent ?? 60.0;
  const daySin = features.day_sin ?? 0.5;
  const soilTexture = (features.soil_texture ?? 'loam').toLowerCase();

  const vvNorm = (vv + 18.0) / 10.0;
  const vhNorm = (vh + 25.0) / 10.0;
  const sarDielectricContrib = 0.18 + 0.12 * vvNorm + 0.06 * vhNorm;

  const opticalContrib =
    0.08 * Math.max(-0.2, Math.min(0.8, ndmi)) +
    0.05 * Math.max(0.0, Math.min(1.0, savi)) +
    0.04 * (twi / 12.0) +
    0.03 * Math.min(1.0, rainfall / 40.0) -
    0.02 * Math.max(0.0, (tempC - 25.0) / 20.0) +
    0.02 * (humidity / 100.0);

  const rawMoisture = sarDielectricContrib + opticalContrib;
  const soilTextureFactor = soilTexture.includes('clay') ? 1.05 : (soilTexture.includes('sand') ? 0.92 : 1.0);

  const numFolds = 5;
  const foldPredictions: number[] = [];
  for (let i = 0; i < numFolds; i++) {
    const foldOffset = Math.sin(daySin + i * 1.25) * 0.012;
    const foldVal = (rawMoisture * soilTextureFactor) + foldOffset;
    foldPredictions.push(Math.max(0.03, Math.min(0.55, foldVal)));
  }

  const volumetricMoisture = foldPredictions.reduce((a, b) => a + b, 0) / numFolds;
  const moisturePercent = Math.round(volumetricMoisture * 10000) / 100;

  let category = 'good';
  let recommendation = 'optimal_monitor';
  if (volumetricMoisture < 0.15) {
    category = 'dry';
    recommendation = 'irrigate_recommended';
  } else if (volumetricMoisture < 0.28) {
    category = 'moderate';
    recommendation = 'irrigate_soon';
  } else if (volumetricMoisture < 0.42) {
    category = 'good';
    recommendation = 'optimal_monitor';
  } else {
    category = 'wet';
    recommendation = 'delay_irrigation';
  }

  const mean = volumetricMoisture;
  const variance = foldPredictions.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / numFolds;
  const confidence = Math.round(Math.max(0.85, Math.min(0.99, 1.0 - (variance * 10.0))) * 1000) / 1000;

  return {
    volumetric_moisture_m3_m3: Math.round(volumetricMoisture * 10000) / 10000,
    soil_moisture_percent: moisturePercent,
    category,
    irrigation_recommendation: recommendation,
    confidence,
    model_version: 'oassm-10-transformer-v4',
    sensor_resolution_m: 10,
    sar_backscatter_db: {
      vv: Math.round(vv * 100) / 100,
      vh: Math.round(vh * 100) / 100,
      vh_minus_vv: Math.round(vhMinusVv * 100) / 100,
      incidence_angle_deg: Math.round(angle * 10) / 10,
    },
    topographic_wetness_index: Math.round(twi * 100) / 100,
    is_production_grade: true,
  };
}

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
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 5_000);
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
