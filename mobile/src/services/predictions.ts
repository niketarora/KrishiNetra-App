import { apiFetch } from './api';
import { DataError } from './errors';

export type SoilMoisturePrediction = {
  soil_moisture_percent: number;
  category: 'dry' | 'moderate' | 'good' | 'wet' | string;
  model_version: string;
  production_ready: boolean;
  experimental: boolean;
  recommendation: string | null;
  warning: string;
};

export type SoilMoistureFeatures = {
  ndvi: number;
  savi: number;
  temperature_c: number;
  humidity_percent: number;
  rainfall: number;
  wind_speed: number;
  soil_ph: number;
  organic_matter: number;
  leaf_area_index: number;
  water_flow: number;
  elevation: number;
  spatial_resolution: number;
  crop_growth_stage: number;
  crop_type: 'maize' | 'rice' | 'wheat' | string;
};

export type FarmPredictionResult = {
  prediction: SoilMoisturePrediction;
  features: SoilMoistureFeatures;
  cropName: string;
};

async function orNullWhenAbsent<T>(load: () => Promise<T>): Promise<T | null> {
  try {
    return await load();
  } catch (error) {
    if (error instanceof DataError && (error.absent || error.translationKey === 'common.serviceUnavailable')) {
      return null;
    }
    return null;
  }
}

/**
 * Retrieves the ML model's Soil Moisture prediction and feature set for a farm.
 */
export async function getFarmSoilMoisture(farmId: string): Promise<FarmPredictionResult | null> {
  return orNullWhenAbsent(async () => {
    return apiFetch<FarmPredictionResult>(
      `/api/v1/farms/${encodeURIComponent(farmId)}/predictions/soil-moisture`,
      { fallbackKey: 'field.predictionError' },
    );
  });
}

/**
 * Directly submits an experimental feature vector to the ML inference service.
 */
export async function predictSoilMoistureCustom(
  features: SoilMoistureFeatures,
): Promise<SoilMoisturePrediction> {
  return apiFetch<SoilMoisturePrediction>('/api/v1/predictions/soil-moisture', {
    method: 'POST',
    body: features,
    fallbackKey: 'field.predictionError',
  });
}
