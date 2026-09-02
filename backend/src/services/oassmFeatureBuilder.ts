import type { OASSMSoilMoistureBody } from '../schemas/prediction.schema.js';
import type { SoilHealthData } from './soilHealth.service.js';
import type { VegetationIndices } from './vegetationAnalysis.service.js';

/**
 * Everything the OASSM-10 feature vector needs that is NOT the one
 * genuinely per-coordinate input (elevation). Extracted from
 * `farmPredictions.service.ts` so `moistureZones.service.ts` can build the
 * same feature vector once per grid cell without duplicating the formulas —
 * both callers must stay byte-for-byte identical in how they turn inputs
 * into a feature vector, or the spatial grid and the farm-level prediction
 * would silently diverge.
 */
export type OassmFeatureContext = {
  cropType: 'maize' | 'rice' | 'wheat';
  growthStage: number;
  tempC: number;
  humidityPct: number;
  rainfallMm: number;
  windSpeedKmh: number;
  vegetation: VegetationIndices;
  soilHealth: SoilHealthData;
  soilTexture: string;
  climateZone: string;
};

/**
 * Builds the OASSM-10 multi-sensor feature vector.
 *
 * `elevationMeters` is the only argument that can legitimately differ
 * between two points on the same farm — every other input here is
 * farm-level/synthetic (see `backend/src/services/soilMoisturePrediction.service.ts`'s
 * header and `docs/PHASE2_5_NOTES.md`). That is also why the spatial grid in
 * `moistureZones.service.ts` produces only prototype-quality variation: this
 * engine has exactly one real per-point signal today (elevation-derived
 * TWI), not per-pixel SAR/optical imagery.
 */
export function buildOassmFeatures(ctx: OassmFeatureContext, elevationMeters: number): OASSMSoilMoistureBody {
  // Day-of-year cyclical encoding (same on every call within a request, farm-level).
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
  const dayAngle = (2 * Math.PI * dayOfYear) / 365.25;
  const daySin = Math.round(Math.sin(dayAngle) * 1000) / 1000;
  const dayCos = Math.round(Math.cos(dayAngle) * 1000) / 1000;

  // Physical Sentinel-1 SAR C-Band Radar Backscatter Modeling (Copernicus Transfer Function)
  const baseVv = -14.5 + Math.min(6.0, (ctx.rainfallMm / 10.0) * 1.5) + ctx.vegetation.ndvi * 2.0;
  const vvDb = Math.round(Math.max(-30.0, Math.min(-5.0, baseVv)) * 10) / 10;
  const vhDb = Math.round(Math.max(-35.0, Math.min(-10.0, vvDb - 6.5 - ctx.vegetation.leaf_area_index * 0.4)) * 10) / 10;
  const vhMinusVv = Math.round((vhDb - vvDb) * 10) / 10;

  // Topographic Wetness Index (TWI) from elevation gradient — the one input
  // that varies per grid cell when this is called from moistureZones.service.ts.
  const slopeDeg = 2.5;
  const twi = Math.round(Math.max(4.0, Math.min(18.0, 7.5 + (elevationMeters / 500.0) * 0.5)) * 10) / 10;

  // Normalized Difference Moisture Index (NDMI) & Thermal LST (Kelvin)
  const ndmi = Math.round((ctx.vegetation.ndvi * 0.45 - 0.05 + ctx.humidityPct / 300.0) * 100) / 100;
  const lstKelvin = Math.round((ctx.tempC + 273.15) * 10) / 10;

  return {
    angle: 38.5,
    vv: vvDb,
    vh: vhDb,
    vh_minus_vv: vhMinusVv,
    sentinel2_b2: 0.045,
    sentinel2_b8a: Math.round((0.15 + ctx.vegetation.ndvi * 0.35) * 1000) / 1000,
    sentinel2_b11: Math.round((0.22 - ctx.vegetation.ndvi * 0.1) * 1000) / 1000,
    sentinel2_b12: Math.round((0.14 - ctx.vegetation.ndvi * 0.06) * 1000) / 1000,
    landsat_b2: 0.05,
    landsat_b7: 0.12,
    landsat_b10: lstKelvin,
    ndvi: ctx.vegetation.ndvi,
    ndmi: Math.max(-0.5, Math.min(0.9, ndmi)),
    savi: ctx.vegetation.savi,
    s2_lag: 2.0,
    landsat_lag: 4.0,
    day_sin: daySin,
    day_cos: dayCos,
    dsm: elevationMeters,
    slope: slopeDeg,
    twi_proxy: twi,
    aspect_sin: 0.0,
    aspect_cos: 1.0,
    temperature_c: ctx.tempC,
    humidity_percent: ctx.humidityPct,
    rainfall: ctx.rainfallMm,
    wind_speed: ctx.windSpeedKmh,
    soil_ph: ctx.soilHealth.soil_ph,
    organic_matter: ctx.soilHealth.organic_matter,
    leaf_area_index: ctx.vegetation.leaf_area_index,
    spatial_resolution: 10.0,
    crop_growth_stage: ctx.growthStage,
    crop_type: ctx.cropType,
    climate_zone: ctx.climateZone,
    soil_texture: ctx.soilTexture,
    land_cover: 'cropland',
  };
}
