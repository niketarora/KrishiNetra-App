import * as farmCrops from '../services/farmCrops.service.js';
import * as farmPredictions from '../services/farmPredictions.service.js';
import * as farms from '../services/farms.service.js';
import * as profiles from '../services/profiles.service.js';
import * as reference from '../services/reference.service.js';
import * as schemes from '../services/schemes.service.js';
import * as soilHealthService from '../services/soilHealth.service.js';
import { MarketIntelligenceService } from '../services/marketIntelligence.service.js';

import type { FarmerContext } from './prompt.js';

const marketIntelligenceService = new MarketIntelligenceService();

/**
 * Gathers what the API already knows about a farmer, so the assistant can
 * answer from facts instead of inventing them.
 *
 * Everything here is read through the farmer's own token, so RLS scopes it to
 * their rows exactly as it does for the Home screen. This is the same data the
 * app is already showing them — it is not a privileged lookup, and it is not
 * tool calling.
 *
 * Every source is optional. A farmer with no field, no crop or no weather
 * simply produces a context with nulls, and the prompt tells the model to say
 * so rather than fill the gaps.
 */

/** Nothing here may fail the request: a missing fact is a null, not a 500. */
async function safely<T>(load: () => Promise<T>): Promise<T | null> {
  try {
    return await load();
  } catch {
    return null;
  }
}

export async function buildFarmerContext(token: string, userId: string): Promise<FarmerContext> {
  const [profile, farmList] = await Promise.all([
    safely(() => profiles.getProfile(token, userId)),
    safely(() => farms.listFarms(token, userId)),
  ]);

  const allLands = farmList ?? [];
  const fields = allLands.map((f, index) => ({
    id: f.id,
    label: `Land ${index + 1}`,
    name: f.name,
    areaAcres: f.area_acres,
    areaHectares: f.area_hectares,
    district: f.district,
    state: f.state,
  }));

  const primaryFarm = allLands[0] ?? null;

  const effectiveState = primaryFarm?.state || profile?.location_state || null;
  const effectiveDistrict = primaryFarm?.district || profile?.location_district || null;

  const context: FarmerContext = {
    farmerName: profile?.full_name ?? null,
    phone: profile?.phone ?? null,
    email: profile?.email ?? null,
    location: effectiveState
      ? {
          city: profile?.location_city ?? null,
          district: effectiveDistrict,
          state: effectiveState,
          source: profile?.location_source ?? null,
        }
      : null,
    language: profile?.language ?? 'en',
    field: primaryFarm
      ? {
          id: primaryFarm.id,
          name: primaryFarm.name,
          areaAcres: primaryFarm.area_acres,
          areaHectares: primaryFarm.area_hectares,
          district: primaryFarm.district,
          state: primaryFarm.state,
        }
      : null,
    fields: fields.length > 0 ? fields : undefined,
    crop: null,
    soilHealth: null,
    soilMoisture: null,
    schemes: null,
    msp: null,
    weather: null,
    marketPrice: null,
  };

  if (!primaryFarm) {
    if (effectiveState) {
      const stateSchemes = await safely(() =>
        schemes.listSchemes(token, { state: effectiveState, limit: 5 }),
      );
      if (stateSchemes && stateSchemes.length > 0) {
        context.schemes = stateSchemes.map((s) => ({
          id: s.row_id,
          name: s.name,
          category: s.category ?? undefined,
          benefitSummary: s.summary,
        }));
      }
    }
    return context;
  }

  const [plantings, catalogue, weather, soilHealthResult, predictionResult, stateSchemes] = await Promise.all([
    safely(() => farmCrops.listFarmCrops(token, userId, primaryFarm.id)),
    safely(() => reference.listCrops(token)),
    primaryFarm.centroid_lat !== null && primaryFarm.centroid_lng !== null
      ? safely(() =>
          reference.latestWeatherForGridCell(
            token,
            Math.round(primaryFarm.centroid_lat * 4) / 4,
            Math.round(primaryFarm.centroid_lng * 4) / 4,
          ),
        )
      : Promise.resolve(null),
    effectiveDistrict && effectiveState
      ? safely(() => soilHealthService.getSoilHealthByDistrict(token, effectiveDistrict, effectiveState))
      : Promise.resolve(null),
    safely(() => farmPredictions.getFarmSoilMoisturePrediction(token, userId, primaryFarm.id)),
    effectiveState
      ? safely(() => schemes.listSchemes(token, { state: effectiveState, limit: 5 }))
      : Promise.resolve(null),
  ]);

  if (weather) {
    context.weather = {
      observedOn: weather.observed_on,
      temperatureC: weather.temperature_c,
      rainfallMm: weather.rainfall_mm,
      humidityPct: weather.humidity_pct,
      source: weather.source,
    };
  }

  if (soilHealthResult) {
    context.soilHealth = {
      soilType: soilHealthResult.soil_type,
      soilPh: soilHealthResult.soil_ph,
      organicMatterPct: soilHealthResult.organic_matter,
      nitrogenKgHa: (soilHealthResult as unknown as { nitrogen_kg_ha?: number }).nitrogen_kg_ha ?? null,
      phosphorusKgHa: (soilHealthResult as unknown as { phosphorus_kg_ha?: number }).phosphorus_kg_ha ?? null,
      potassiumKgHa: (soilHealthResult as unknown as { potassium_kg_ha?: number }).potassium_kg_ha ?? null,
      source: soilHealthResult.source || 'ICAR Soil Health Card',
    };
  }

  if (predictionResult?.prediction) {
    const p = predictionResult.prediction;
    context.soilMoisture = {
      moisturePercent: p.soil_moisture_percent,
      category: p.category,
      volumetricM3M3: p.volumetric_moisture_m3_m3,
      recommendation: p.irrigation_recommendation,
      sensorResolutionM: p.sensor_resolution_m ?? 10,
    };
  }

  if (stateSchemes && stateSchemes.length > 0) {
    context.schemes = stateSchemes.map((s) => ({
      id: s.row_id,
      name: s.name,
      category: s.category ?? undefined,
      benefitSummary: s.summary,
    }));
  }

  // The crop currently in the ground — the same rule the Home tile uses.
  const planting = (plantings ?? [])
    .filter((entry) => entry.status !== 'harvested')
    .sort((a, b) => (b.sown_on ?? '').localeCompare(a.sown_on ?? ''))[0];

  const crop = planting ? catalogue?.find((entry) => entry.id === planting.crop_id) : undefined;

  if (!planting || !crop) return context;

  let growthStageName: string | null = null;
  let daysSinceSow: number | null = null;
  if (planting.sown_on) {
    const sownDate = new Date(planting.sown_on);
    if (!Number.isNaN(sownDate.getTime())) {
      daysSinceSow = Math.max(0, Math.floor((Date.now() - sownDate.getTime()) / (1000 * 60 * 60 * 24)));
      if (daysSinceSow < 20) growthStageName = 'Germination';
      else if (daysSinceSow < 55) growthStageName = 'Tillering / Vegetative';
      else if (daysSinceSow < 90) growthStageName = 'Flowering';
      else if (daysSinceSow < 120) growthStageName = 'Grain Filling';
      else growthStageName = 'Maturity';
    }
  }

  context.crop = {
    name: crop.name_en,
    variety: planting.variety,
    sownOn: planting.sown_on,
    daysSinceSown: daysSinceSow,
    growthStage: growthStageName,
    expectedHarvestOn: planting.expected_harvest_on,
  };

  const [msp, prices, marketIntel] = await Promise.all([
    safely(() => reference.listMsp(token, { crop: crop.code })),
    safely(() => reference.listMarketPrices(token, { crop: crop.code, limit: 1 })),
    safely(() =>
      marketIntelligenceService.analyse({
        crop: crop.name_en,
        quantity: 50,
        location: effectiveDistrict || effectiveState || 'Kota',
        locale: profile?.language?.startsWith('hi') ? 'hi' : 'en',
      }),
    ),
  ]);

  const latestMsp = msp?.[0];
  if (latestMsp) {
    context.msp = {
      pricePerQuintal: latestMsp.price_per_quintal,
      marketingYear: latestMsp.marketing_year,
      source: latestMsp.source,
    };
  }

  const latestPrice = prices?.[0];
  if (latestPrice) {
    context.marketPrice = {
      mandi: (latestPrice as unknown as { mandis?: { code?: string } }).mandis?.code ?? 'the mandi',
      priceDate: latestPrice.price_date,
      modalPrice: latestPrice.modal_price,
      minPrice: latestPrice.min_price,
      maxPrice: latestPrice.max_price,
      source: latestPrice.source,
    };
  }

  if (marketIntel) {
    context.marketIntelligence = {
      crop: marketIntel.market_intelligence.crop,
      location: marketIntel.market_intelligence.location,
      currentMandiPrice: marketIntel.market_intelligence.current_mandi_price,
      minPrice: marketIntel.market_intelligence.min_price,
      maxPrice: marketIntel.market_intelligence.max_price,
      forecastDay3Min: marketIntel.price_prediction.predicted_3_day_price_min,
      forecastDay3Max: marketIntel.price_prediction.predicted_3_day_price_max,
      forecastDay7Min: marketIntel.price_prediction.predicted_7_day_price_min,
      forecastDay7Max: marketIntel.price_prediction.predicted_7_day_price_max,
      trend7DaysPercent: marketIntel.market_intelligence.trend_7_days,
      saleAdvice: marketIntel.sale_recommendation.recommendation,
      saleReason: marketIntel.sale_recommendation.reason,
      verifiedBuyersCount: marketIntel.buyer_matches.length,
      topBuyerDemandRate: marketIntel.best_buyer?.offered_price,
    };
  }

  return context;
}
