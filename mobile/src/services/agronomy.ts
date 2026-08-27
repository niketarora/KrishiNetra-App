import { apiFetch, asNumber } from './api';
import type { CropRow, FarmCropRow, MspRow, WeatherRow } from './database.types';
import { DataError } from './errors';

/**
 * Crop, MSP and weather reads for the Home dashboard.
 *
 * Same rule as `farms.ts` and `profiles.ts`: screens call this module, this
 * module calls the API, and nothing else in the app touches the network.
 *
 * Everything here can legitimately come back empty. A farmer who has not
 * recorded a crop has no crop; a district with no ingested observation has no
 * weather. Those are answers, not errors, so they return null and the screen
 * renders its established empty state rather than a number.
 */

export type FarmCrop = FarmCropRow;
export type Crop = CropRow;
export type Msp = MspRow;
export type Weather = WeatherRow;

/** A planting joined to its catalogue entry, which is what Home actually shows. */
export type CurrentCrop = {
  crop: Crop;
  planting: FarmCrop;
};

/**
 * `null` is a normal outcome for every function below, so a missing resource
 * must not surface as a failure. Anything else — a real transport or server
 * error — still throws, because the farmer should know the app is broken.
 */
async function orNullWhenAbsent<T>(load: () => Promise<T>): Promise<T | null> {
  try {
    return await load();
  } catch (error) {
    if (error instanceof DataError && error.absent) return null;
    throw error;
  }
}

export async function listCrops(): Promise<Crop[]> {
  return apiFetch<Crop[]>('/api/v1/crops', { fallbackKey: 'home.loadError' });
}

export async function listFarmCrops(farmId: string): Promise<FarmCrop[]> {
  const crops = await apiFetch<FarmCrop[]>(`/api/v1/farms/${farmId}/crops`, {
    fallbackKey: 'home.loadError',
  });

  return crops.map((crop) => ({
    ...crop,
    area_acres: crop.area_acres === null ? null : asNumber(crop.area_acres),
  }));
}

/**
 * The crop the farmer is growing now, or null.
 *
 * "Now" means the newest planting that has not been harvested. A field whose
 * only record is last season's harvest is between crops, and saying so is more
 * useful than naming a crop that is no longer in the ground.
 */
export function selectCurrentPlanting(plantings: FarmCrop[]): FarmCrop | null {
  const active = plantings.filter((planting) => planting.status !== 'harvested');
  if (active.length === 0) return null;

  // Newest sowing first; undated plantings sort last rather than winning.
  const sorted = [...active].sort((a, b) => (b.sown_on ?? '').localeCompare(a.sown_on ?? ''));
  return sorted[0] ?? null;
}

export async function getCurrentCrop(farmId: string): Promise<CurrentCrop | null> {
  const [plantings, catalogue] = await Promise.all([listFarmCrops(farmId), listCrops()]);

  const planting = selectCurrentPlanting(plantings);
  if (!planting) return null;

  const crop = catalogue.find((entry) => entry.id === planting.crop_id);
  // A planting whose catalogue entry is missing cannot be named honestly.
  if (!crop) return null;

  return { crop, planting };
}

/**
 * The most recent published MSP for a crop, or null when none is recorded.
 *
 * The API returns marketing years newest-first, so the first row is current.
 */
export async function getLatestMsp(cropCode: string): Promise<Msp | null> {
  const rows = await apiFetch<Msp[]>(`/api/v1/msp?crop=${encodeURIComponent(cropCode)}`, {
    fallbackKey: 'home.loadError',
  });

  const latest = rows[0];
  if (!latest) return null;

  return { ...latest, price_per_quintal: asNumber(latest.price_per_quintal) };
}

/**
 * The latest observed weather for the field's district, or null.
 *
 * The API answers 503 when the field has no resolved district or no
 * observation has been ingested for it. That is an expected state, not a
 * failure, so it becomes null here and the tile stays in its empty form.
 */
export async function getWeather(farmId: string): Promise<Weather | null> {
  return orNullWhenAbsent(async () => {
    const weather = await apiFetch<Weather>(
      `/api/v1/weather?farmId=${encodeURIComponent(farmId)}`,
      { fallbackKey: 'home.loadError' },
    );

    return {
      ...weather,
      temperature_c: weather.temperature_c === null ? null : asNumber(weather.temperature_c),
      rainfall_mm: weather.rainfall_mm === null ? null : asNumber(weather.rainfall_mm),
      humidity_pct: weather.humidity_pct === null ? null : asNumber(weather.humidity_pct),
    };
  });
}

/** One mandi price observation, as `/api/v1/market-prices` returns it. */
export type MarketPrice = {
  id: string;
  price_date: string;
  min_price: number | null;
  max_price: number | null;
  modal_price: number;
  arrivals_tonnes: number | null;
  source: string;
  mandis?: { code?: string } | null;
};

/**
 * Recent mandi observations for a crop, newest first.
 *
 * Returns an empty array when nothing has been ingested for that crop. That is
 * an answer, not a failure — the screens show their "not connected" state for
 * it rather than widening the query until something comes back.
 */
export async function listMarketPrices(
  cropCode: string,
  limit = 30,
): Promise<MarketPrice[]> {
  const rows = await apiFetch<MarketPrice[]>(
    `/api/v1/market-prices?crop=${encodeURIComponent(cropCode)}&limit=${limit}`,
    { fallbackKey: 'market.loadError' },
  );

  return rows.map((row) => ({
    ...row,
    modal_price: asNumber(row.modal_price),
    min_price: row.min_price === null ? null : asNumber(row.min_price),
    max_price: row.max_price === null ? null : asNumber(row.max_price),
    arrivals_tonnes: row.arrivals_tonnes === null ? null : asNumber(row.arrivals_tonnes),
  }));
}

/** The most recent observation for a crop, or null if none exists. */
export async function getLatestMarketPrice(cropCode: string): Promise<MarketPrice | null> {
  const rows = await listMarketPrices(cropCode, 1);
  return rows[0] ?? null;
}
