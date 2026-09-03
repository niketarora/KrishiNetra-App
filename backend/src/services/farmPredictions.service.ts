import type { OASSMSoilMoistureBody } from '../schemas/prediction.schema.js';
import type { OASSMSoilMoisturePrediction } from './soilMoisturePrediction.service.js';
import { calculateLocalOASSM10, predictSoilMoisture } from './soilMoisturePrediction.service.js';
import { getFarm } from './farms.service.js';
import { listFarmCrops } from './farmCrops.service.js';
import { listCrops, latestWeatherForDistrict, latestWeatherForGridCell } from './reference.service.js';
import { getElevationForCoordinates } from './elevation.service.js';
import { getSoilHealthByDistrict } from './soilHealth.service.js';
import { analyzeFieldVegetation } from './vegetationAnalysis.service.js';
import { buildOassmFeatures, type OassmFeatureContext } from './oassmFeatureBuilder.js';

export type FarmPredictionResponse = {
  prediction: OASSMSoilMoisturePrediction;
  features: OASSMSoilMoistureBody;
  cropName: string;
};

export async function getFarmSoilMoisturePrediction(
  token: string,
  userId: string,
  farmId: string,
): Promise<FarmPredictionResponse> {
  // 1. Verify farm ownership & existence
  const farm = await getFarm(token, userId, farmId);

  // 2. Concurrently fetch farm crops, catalog, elevation, and soil health
  const [farmCrops, allCrops, elevationMeters, soilHealth] = await Promise.all([
    listFarmCrops(token, userId, farmId).catch(() => []),
    listCrops(token).catch(() => []),
    getElevationForCoordinates(farm.centroid_lat, farm.centroid_lng).catch(() => 350.0),
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

  // 3. Resolve active crop
  const activePlanting = farmCrops.find((c) => c.status !== 'harvested') ?? farmCrops[0];
  const matchedCrop = activePlanting
    ? allCrops.find((c) => c.id === activePlanting.crop_id)
    : null;

  let cropType: 'maize' | 'rice' | 'wheat' = 'wheat';
  let cropName = 'Wheat';

  if (matchedCrop) {
    const code = matchedCrop.code.toLowerCase();
    cropName = matchedCrop.name_en;
    if (code.includes('rice') || code.includes('paddy')) {
      cropType = 'rice';
    } else if (code.includes('maize') || code.includes('corn')) {
      cropType = 'maize';
    } else {
      cropType = 'wheat';
    }
  }

  // 4. Calculate growth stage (1-5) from sowing date
  let growthStage = 2; // vegetative default
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

  // 5. Extract live weather parameters
  const tempC = weather?.temperature_c != null ? Number(weather.temperature_c) : 28.0;
  const humidityPct = weather?.humidity_pct != null ? Number(weather.humidity_pct) : 60.0;
  const rainfallMm = weather?.rainfall_mm != null ? Number(weather.rainfall_mm) : 15.0;
  const windSpeedKmh =
    weather?.wind_speed_kmh != null
      ? Number(weather.wind_speed_kmh)
      : Math.round((3.2 + (tempC > 35 ? 4.5 : 1.5)) * 10) / 10;

  // 6. Derive optical vegetation indices (NDVI, SAVI, LAI)
  const vegetation = analyzeFieldVegetation({
    cropType,
    growthStage,
    photoUrl: (farm as unknown as { photo_url?: string | null }).photo_url,
  });

  // 7. USDA Soil Texture Mapping
  let soilTexture = 'loam';
  const rawSoilType = (soilHealth.soil_type || '').toLowerCase();
  if (rawSoilType.includes('clay')) soilTexture = 'clay_loam';
  else if (rawSoilType.includes('sand')) soilTexture = 'sandy_loam';
  else if (rawSoilType.includes('silt') || rawSoilType.includes('alluvial')) soilTexture = 'silt_loam';

  // 8. Climate zone classification (Köppen-Geiger)
  const stateName = (farm.state || '').toLowerCase();
  let climateZone = 'Cwa'; // Subtropical Monsoon
  if (stateName.includes('rajasthan') || stateName.includes('gujarat')) climateZone = 'BSh'; // Semi-arid
  else if (stateName.includes('kerala') || stateName.includes('goa')) climateZone = 'Am'; // Tropical Monsoon

  // 9. Assemble the OASSM-10 multi-sensor payload. Shared with
  // moistureZones.service.ts's per-cell grid via oassmFeatureBuilder.ts, so
  // the farm-level scalar and the spatial grid can never silently diverge.
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
  const features: OASSMSoilMoistureBody = buildOassmFeatures(featureContext, elevationMeters);

  // 10. Run inference via ML service with graceful local OASSM-10 fallback
  let prediction: OASSMSoilMoisturePrediction;
  try {
    prediction = await predictSoilMoisture(features);
  } catch {
    prediction = calculateLocalOASSM10(features);
  }

  return {
    prediction,
    features,
    cropName,
  };
}
