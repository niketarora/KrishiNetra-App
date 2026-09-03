import { getFarm } from './farms.service.js';
import { listFarmCrops } from './farmCrops.service.js';
import { listCrops, latestWeatherForDistrict, latestWeatherForGridCell } from './reference.service.js';
import { getElevationBatch } from './elevation.service.js';
import { getSoilHealthByDistrict } from './soilHealth.service.js';
import { analyzeFieldVegetation } from './vegetationAnalysis.service.js';
import { calculateLocalOASSM10, predictSoilMoisture } from './soilMoisturePrediction.service.js';
import { buildOassmFeatures, type OassmFeatureContext } from './oassmFeatureBuilder.js';
import { generateFarmGrid, haversineDistanceMeters, type GridPoint } from '../utils/spatialGrid.js';

/**
 * Spatial moisture-zone estimation — see `docs/PHASE2_5_NOTES.md` and this
 * feature's own investigation notes for the full picture, but the short
 * version: KrishiNetra's soil-moisture "model" (`soilMoisturePrediction.service.ts`)
 * is a deterministic formula, not genuine pretrained OASSM-10 inference, and
 * it only ever had one real per-point input (elevation-derived TWI). This
 * module runs that SAME formula once per point on a grid instead of once at
 * the farm centroid, which is honestly still a prototype spatial estimate,
 * never a measured reading. Every response is labelled accordingly —
 * `method`/`provenance`/`source` exist so nothing downstream can present this
 * as more than it is.
 */

export type MoistureZoneRelativeStatus = 'LOWER_THAN_FARM_AVERAGE' | 'NEAR_FARM_AVERAGE';

export type MoistureZoneTarget = {
  id: string;
  center: { lat: number; lng: number };
  estimatedMoisturePercent: number;
  relativeStatus: MoistureZoneRelativeStatus;
  priority: number;
  source: 'prototype_spatial_estimate';
  provenance: 'existing_krishinetra_moisture_engine';
  generatedAt: string;
};

export type FarmMoistureZonesResponse = {
  farmId: string;
  farmAverageMoisturePercent: number | null;
  method: 'prototype_spatial_estimate';
  provenance: 'existing_krishinetra_moisture_engine';
  generatedAt: string;
  gridSpacingMeters: number;
  cellCount: number;
  targets: MoistureZoneTarget[];
};

const GRID_SPACING_METERS = 20;
const MAX_GRID_CELLS = 150;
const MAX_TARGETS = 3;
const MIN_TARGET_SEPARATION_METERS = 20;
const ELEVATION_BATCH_TIMEOUT_MS = 8_000;
/** How many cells run through the prediction formula at once. Cheap arithmetic locally, but `predictSoilMoisture` may call a real remote ML service if `ML_SERVICE_URL` is configured — bounded concurrency keeps that polite. */
const PREDICTION_CONCURRENCY = 5;

export type CellPrediction = { point: GridPoint; moisturePercent: number };

/** Same "call the real engine, fall back to the local deterministic formula" pattern as the farm-level prediction (`farmPredictions.service.ts`). */
async function predictCellMoisture(features: Parameters<typeof calculateLocalOASSM10>[0]) {
  try {
    return await predictSoilMoisture(features);
  } catch {
    return calculateLocalOASSM10(features);
  }
}

/** Runs `task` over `items` with at most `limit` in flight at once — no external dependency needed for something this small. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await task(items[index] as T, index);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

/**
 * Sorts cells driest-first and greedily picks up to `maxTargets`, skipping
 * any candidate within `minSeparationMeters` of a target already chosen —
 * the MVP's stand-in for real clustering (task explicitly asks for this
 * instead of GIS clustering). Pure and synchronous so it can be unit-tested
 * without mocking the farm/weather/elevation pipeline above it.
 */
export function selectDriestTargets(
  cells: CellPrediction[],
  options: {
    maxTargets: number;
    minSeparationMeters: number;
    farmAverageMoisturePercent: number | null;
    generatedAt: string;
  },
): MoistureZoneTarget[] {
  const driestFirst = [...cells].sort((a, b) => a.moisturePercent - b.moisturePercent);
  const { maxTargets, minSeparationMeters, farmAverageMoisturePercent, generatedAt } = options;

  const targets: MoistureZoneTarget[] = [];
  for (const cell of driestFirst) {
    if (targets.length >= maxTargets) break;

    const tooCloseToExisting = targets.some(
      (target) => haversineDistanceMeters(target.center as GridPoint, cell.point) < minSeparationMeters,
    );
    if (tooCloseToExisting) continue;

    const relativeStatus: MoistureZoneRelativeStatus =
      farmAverageMoisturePercent != null && cell.moisturePercent < farmAverageMoisturePercent
        ? 'LOWER_THAN_FARM_AVERAGE'
        : 'NEAR_FARM_AVERAGE';

    targets.push({
      id: `zone-${targets.length + 1}`,
      center: { lat: cell.point.lat, lng: cell.point.lng },
      estimatedMoisturePercent: cell.moisturePercent,
      relativeStatus,
      priority: targets.length + 1,
      source: 'prototype_spatial_estimate',
      provenance: 'existing_krishinetra_moisture_engine',
      generatedAt,
    });
  }

  return targets;
}

export async function getFarmMoistureZones(
  token: string,
  userId: string,
  farmId: string,
): Promise<FarmMoistureZonesResponse> {
  const farm = await getFarm(token, userId, farmId);
  const generatedAt = new Date().toISOString();

  const gridPoints = generateFarmGrid(farm.boundary, {
    spacingMeters: GRID_SPACING_METERS,
    maxCells: MAX_GRID_CELLS,
  });

  if (gridPoints.length === 0) {
    return {
      farmId,
      farmAverageMoisturePercent: null,
      method: 'prototype_spatial_estimate',
      provenance: 'existing_krishinetra_moisture_engine',
      generatedAt,
      gridSpacingMeters: GRID_SPACING_METERS,
      cellCount: 0,
      targets: [],
    };
  }

  // Same farm-level inputs the existing Field Analysis prediction uses
  // (crop, weather, soil health) — reused as-is, not recomputed per cell.
  const [farmCrops, allCrops, soilHealth] = await Promise.all([
    listFarmCrops(token, userId, farmId).catch(() => []),
    listCrops(token).catch(() => []),
    getSoilHealthByDistrict(token, farm.district, farm.state).catch(() => ({
      soil_ph: 7.2,
      organic_matter: 0.65,
      soil_type: 'Alluvial Loam',
      source: 'ICAR Baseline',
    })),
  ]);

  let weather = null;
  if (farm.district && farm.state) {
    weather = await latestWeatherForDistrict(token, farm.district, farm.state).catch(() => null);
  }
  if (!weather && farm.centroid_lat != null && farm.centroid_lng != null) {
    weather = await latestWeatherForGridCell(token, farm.centroid_lat, farm.centroid_lng).catch(() => null);
  }

  const activePlanting = farmCrops.find((c) => c.status !== 'harvested') ?? farmCrops[0];
  const matchedCrop = activePlanting ? allCrops.find((c) => c.id === activePlanting.crop_id) : null;

  let cropType: 'maize' | 'rice' | 'wheat' = 'wheat';
  if (matchedCrop) {
    const code = matchedCrop.code.toLowerCase();
    if (code.includes('rice') || code.includes('paddy')) cropType = 'rice';
    else if (code.includes('maize') || code.includes('corn')) cropType = 'maize';
  }

  let growthStage = 2;
  if (activePlanting?.sown_on) {
    const sownDate = new Date(activePlanting.sown_on);
    if (!Number.isNaN(sownDate.getTime())) {
      const daysSinceSow = Math.max(0, Math.floor((Date.now() - sownDate.getTime()) / (1000 * 60 * 60 * 24)));
      if (daysSinceSow < 20) growthStage = 1;
      else if (daysSinceSow < 55) growthStage = 2;
      else if (daysSinceSow < 90) growthStage = 3;
      else if (daysSinceSow < 120) growthStage = 4;
      else growthStage = 5;
    }
  }

  const tempC = weather?.temperature_c != null ? Number(weather.temperature_c) : 28.0;
  const humidityPct = weather?.humidity_pct != null ? Number(weather.humidity_pct) : 60.0;
  const rainfallMm = weather?.rainfall_mm != null ? Number(weather.rainfall_mm) : 15.0;
  const windSpeedKmh =
    weather?.wind_speed_kmh != null
      ? Number(weather.wind_speed_kmh)
      : Math.round((3.2 + (tempC > 35 ? 4.5 : 1.5)) * 10) / 10;

  const vegetation = analyzeFieldVegetation({
    cropType,
    growthStage,
    photoUrl: (farm as unknown as { photo_url?: string | null }).photo_url,
  });

  let soilTexture = 'loam';
  const rawSoilType = (soilHealth.soil_type || '').toLowerCase();
  if (rawSoilType.includes('clay')) soilTexture = 'clay_loam';
  else if (rawSoilType.includes('sand')) soilTexture = 'sandy_loam';
  else if (rawSoilType.includes('silt') || rawSoilType.includes('alluvial')) soilTexture = 'silt_loam';

  const stateName = (farm.state || '').toLowerCase();
  let climateZone = 'Cwa';
  if (stateName.includes('rajasthan') || stateName.includes('gujarat')) climateZone = 'BSh';
  else if (stateName.includes('kerala') || stateName.includes('goa')) climateZone = 'Am';

  const featureContext: OassmFeatureContext = {
    cropType,
    growthStage,
    tempC,
    humidityPct,
    rainfallMm,
    windSpeedKmh,
    vegetation,
    soilHealth,
    soilTexture,
    climateZone,
  };

  // The one genuinely per-point input this engine has: real per-coordinate
  // elevation (Open-Meteo), batched into a single request for the whole grid.
  const elevations = await getElevationBatch(gridPoints, { timeoutMs: ELEVATION_BATCH_TIMEOUT_MS }).catch(() =>
    gridPoints.map(() => 350.0),
  );

  const cellResults = await mapWithConcurrency(gridPoints, PREDICTION_CONCURRENCY, async (point, index) => {
    const elevationMeters = elevations[index] ?? 350.0;
    const features = buildOassmFeatures(featureContext, elevationMeters);
    const prediction = await predictCellMoisture(features);
    return { point, moisturePercent: prediction.soil_moisture_percent } satisfies CellPrediction;
  });

  const validCells = cellResults.filter((cell) => Number.isFinite(cell.moisturePercent));

  const farmAverageMoisturePercent =
    validCells.length > 0
      ? Math.round((validCells.reduce((sum, cell) => sum + cell.moisturePercent, 0) / validCells.length) * 100) / 100
      : null;

  const targets = selectDriestTargets(validCells, {
    maxTargets: MAX_TARGETS,
    minSeparationMeters: MIN_TARGET_SEPARATION_METERS,
    farmAverageMoisturePercent,
    generatedAt,
  });

  return {
    farmId,
    farmAverageMoisturePercent,
    method: 'prototype_spatial_estimate',
    provenance: 'existing_krishinetra_moisture_engine',
    generatedAt,
    gridSpacingMeters: GRID_SPACING_METERS,
    cellCount: validCells.length,
    targets,
  };
}
