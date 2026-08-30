import type { ExperimentalSoilMoistureBody } from '../schemas/prediction.schema.js';
import type { ExperimentalSoilMoisturePrediction } from './soilMoisturePrediction.service.js';
import { predictSoilMoisture } from './soilMoisturePrediction.service.js';
import { getFarm } from './farms.service.js';
import { listFarmCrops } from './farmCrops.service.js';
import { listCrops, latestWeatherForDistrict, latestWeatherForGridCell } from './reference.service.js';

export type FarmPredictionResponse = {
  prediction: ExperimentalSoilMoisturePrediction;
  features: ExperimentalSoilMoistureBody;
  cropName: string;
};

export async function getFarmSoilMoisturePrediction(
  token: string,
  userId: string,
  farmId: string,
): Promise<FarmPredictionResponse> {
  // 1. Verify farm ownership & existence
  const farm = await getFarm(token, userId, farmId);

  // 2. Fetch farm crops & weather
  const [farmCrops, allCrops] = await Promise.all([
    listFarmCrops(token, userId, farmId).catch(() => []),
    listCrops(token).catch(() => []),
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

  // 4. Calculate approximate growth stage (1-5) from sowing date
  let growthStage = 2; // vegetative default
  if (activePlanting?.sown_on) {
    const sownDate = new Date(activePlanting.sown_on);
    if (!Number.isNaN(sownDate.getTime())) {
      const daysSinceSow = Math.max(0, Math.floor((Date.now() - sownDate.getTime()) / (1000 * 60 * 60 * 24)));
      if (daysSinceSow < 20) growthStage = 1; // germination
      else if (daysSinceSow < 55) growthStage = 2; // vegetative
      else if (daysSinceSow < 90) growthStage = 3; // flowering
      else if (daysSinceSow < 120) growthStage = 4; // grain filling
      else growthStage = 5; // maturity
    }
  }

  // 5. Extract weather parameters or sensible agronomic defaults
  const tempC = weather?.temperature_c != null ? Number(weather.temperature_c) : 28.0;
  const humidityPct = weather?.humidity_pct != null ? Number(weather.humidity_pct) : 60.0;
  const rainfallMm = weather?.rainfall_mm != null ? Number(weather.rainfall_mm) : 15.0;

  const features: ExperimentalSoilMoistureBody = {
    ndvi: 0.58,
    savi: 0.42,
    temperature_c: tempC,
    humidity_percent: humidityPct,
    rainfall: rainfallMm,
    wind_speed: 3.5,
    soil_ph: 6.8,
    organic_matter: 2.2,
    leaf_area_index: 2.1,
    water_flow: 25.0,
    elevation: 450.0,
    spatial_resolution: 10.0,
    crop_growth_stage: growthStage,
    crop_type: cropType,
  };

  // 6. Run inference via ML service
  const prediction = await predictSoilMoisture(features);

  return {
    prediction,
    features,
    cropName,
  };
}
