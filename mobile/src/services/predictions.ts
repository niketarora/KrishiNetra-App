import { apiFetch } from './api';
import { DataError } from './errors';

export type SarBackscatter = {
  vv: number;
  vh: number;
  vh_minus_vv: number;
  incidence_angle_deg: number;
};

export type SoilMoisturePrediction = {
  volumetric_moisture_m3_m3?: number;
  soil_moisture_percent: number;
  category: 'dry' | 'moderate' | 'good' | 'wet' | string;
  irrigation_recommendation?: string;
  confidence?: number;
  model_version: string;
  sensor_resolution_m?: number;
  sar_backscatter_db?: SarBackscatter;
  topographic_wetness_index?: number;
  is_production_grade?: boolean;
  production_ready?: boolean;
  experimental?: boolean;
  recommendation?: string | null;
  warning?: string | null;
};

export type SoilMoistureFeatures = {
  angle?: number;
  vv?: number;
  vh?: number;
  vh_minus_vv?: number;
  sentinel2_b2?: number;
  sentinel2_b8a?: number;
  sentinel2_b11?: number;
  sentinel2_b12?: number;
  landsat_b2?: number;
  landsat_b7?: number;
  landsat_b10?: number;
  ndvi: number;
  ndmi?: number;
  savi: number;
  s2_lag?: number;
  landsat_lag?: number;
  day_sin?: number;
  day_cos?: number;
  dsm?: number;
  slope?: number;
  twi_proxy?: number;
  aspect_sin?: number;
  aspect_cos?: number;
  temperature_c: number;
  humidity_percent: number;
  rainfall: number;
  wind_speed: number;
  soil_ph: number;
  organic_matter: number;
  leaf_area_index: number;
  water_flow?: number;
  elevation?: number;
  spatial_resolution?: number;
  crop_growth_stage?: number;
  crop_type: 'maize' | 'rice' | 'wheat' | string;
  climate_zone?: string;
  soil_texture?: string;
  land_cover?: string;
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
 * Retrieves the OASSM-10 10m Multi-Sensor Soil Moisture prediction and feature set for a farm.
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
 * Directly submits a feature vector to the ML inference service.
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

export type MoistureZoneTarget = {
  id: string;
  center: { lat: number; lng: number };
  estimatedMoisturePercent: number;
  relativeStatus: 'LOWER_THAN_FARM_AVERAGE' | 'NEAR_FARM_AVERAGE';
  priority: number;
  source: string;
  provenance: string;
  generatedAt: string;
};

export type FarmMoistureZones = {
  farmId: string;
  farmAverageMoisturePercent: number | null;
  method: string;
  provenance: string;
  generatedAt: string;
  gridSpacingMeters: number;
  cellCount: number;
  targets: MoistureZoneTarget[];
};

/**
 * Prototype spatial extension of the same experimental engine above — see
 * `backend/src/services/moistureZones.service.ts`'s header. Never a claim of
 * measured moisture or genuine per-pixel satellite inference.
 */
export async function getFarmMoistureZones(farmId: string): Promise<FarmMoistureZones | null> {
  return orNullWhenAbsent(async () => {
    return apiFetch<FarmMoistureZones>(
      `/api/v1/farms/${encodeURIComponent(farmId)}/moisture-zones`,
      { fallbackKey: 'arMoisture.zonesUnavailable' },
    );
  });
}
