import * as farmCrops from '../services/farmCrops.service.js';
import * as farms from '../services/farms.service.js';
import * as profiles from '../services/profiles.service.js';
import * as reference from '../services/reference.service.js';

import type { FarmerContext } from './prompt.js';

/**
 * Gathers what the API already knows about a farmer, so the assistant can
 * answer from facts instead of inventing them.
 *
 * Everything here is read through the farmer's own token, so RLS scopes it to
 * their rows exactly as it does for the Home screen. This is the same data the
 * app is already showing them — it is not a privileged lookup, and it is not
 * tool calling. The AI Agent that can go and fetch more is Phase 5.
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
    safely(() => farms.listFarms(token, userId, 1)),
  ]);

  const farm = farmList?.[0] ?? null;

  const context: FarmerContext = {
    farmerName: profile?.full_name ?? null,
    language: profile?.language ?? 'en',
    field: farm
      ? {
          name: farm.name,
          areaAcres: farm.area_acres,
          district: farm.district,
          state: farm.state,
        }
      : null,
    crop: null,
    msp: null,
    weather: null,
    marketPrice: null,
  };

  if (!farm) return context;

  const [plantings, catalogue, weather] = await Promise.all([
    safely(() => farmCrops.listFarmCrops(token, userId, farm.id)),
    safely(() => reference.listCrops(token)),
    farm.centroid_lat !== null && farm.centroid_lng !== null
      ? safely(() =>
          reference.latestWeatherForGridCell(
            token,
            Math.round(farm.centroid_lat * 4) / 4,
            Math.round(farm.centroid_lng * 4) / 4,
          ),
        )
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

  // The crop currently in the ground — the same rule the Home tile uses. A
  // harvested crop is not what they are growing now.
  const planting = (plantings ?? [])
    .filter((entry) => entry.status !== 'harvested')
    .sort((a, b) => (b.sown_on ?? '').localeCompare(a.sown_on ?? ''))[0];

  const crop = planting ? catalogue?.find((entry) => entry.id === planting.crop_id) : undefined;

  if (!planting || !crop) return context;

  context.crop = {
    name: crop.name_en,
    variety: planting.variety,
    sownOn: planting.sown_on,
    expectedHarvestOn: planting.expected_harvest_on,
  };

  const [msp, prices] = await Promise.all([
    safely(() => reference.listMsp(token, { crop: crop.code })),
    safely(() => reference.listMarketPrices(token, { crop: crop.code, limit: 1 })),
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
    // The mandi name is not on the row, so it is described by what is: the
    // observation's date and source. The prompt makes the model say both.
    context.marketPrice = {
      mandi: (latestPrice as unknown as { mandis?: { code?: string } }).mandis?.code ?? 'the mandi',
      priceDate: latestPrice.price_date,
      modalPrice: latestPrice.modal_price,
      minPrice: latestPrice.min_price,
      maxPrice: latestPrice.max_price,
      source: latestPrice.source,
    };
  }

  return context;
}
