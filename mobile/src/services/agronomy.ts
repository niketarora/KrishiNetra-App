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

/** What Land Registration collects for a newly-registered field's crop. */
export type CreateFarmCropInput = {
  crop_id: string;
  variety?: string | null;
  sown_on?: string | null;
  notes?: string | null;
};

/**
 * Records the crop a farmer is growing on a field.
 *
 * The endpoint has existed since Phase 2 (`POST /api/v1/farms/:farmId/crops`)
 * but no screen called it until Land Registration — see that endpoint's
 * comment: "Phase 3 has somewhere to read the farmer's crop and variety from."
 */
export async function createFarmCrop(
  farmId: string,
  input: CreateFarmCropInput,
): Promise<FarmCrop> {
  const crop = await apiFetch<FarmCrop>(`/api/v1/farms/${farmId}/crops`, {
    method: 'POST',
    body: input,
    fallbackKey: 'myFarm.saveCropError',
  });

  return { ...crop, area_acres: crop.area_acres === null ? null : asNumber(crop.area_acres) };
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
 * The most recently harvested planting, or null.
 *
 * "Previous crop" only means something once something has actually been
 * harvested — a field between its first and only crop has no previous one,
 * and that is the honest answer rather than guessing at an older sowing.
 */
export function selectPreviousPlanting(plantings: FarmCrop[]): FarmCrop | null {
  const harvested = plantings.filter((planting) => planting.status === 'harvested');
  if (harvested.length === 0) return null;

  const sorted = [...harvested].sort((a, b) => (b.sown_on ?? '').localeCompare(a.sown_on ?? ''));
  return sorted[0] ?? null;
}

export type CropHistory = { current: CurrentCrop | null; previous: CurrentCrop | null };

/**
 * Current and previous crop together, for Krishi Memory's Farm Overview.
 *
 * Fetches plantings and the catalogue once and derives both from it, rather
 * than calling `getCurrentCrop` and a hypothetical `getPreviousCrop`
 * separately — a farmer's crop history is one screen's concern, not two
 * round trips.
 */
export async function getCropHistory(farmId: string): Promise<CropHistory> {
  const [plantings, catalogue] = await Promise.all([listFarmCrops(farmId), listCrops()]);

  const resolve = (planting: FarmCrop | null): CurrentCrop | null => {
    if (!planting) return null;
    const crop = catalogue.find((entry) => entry.id === planting.crop_id);
    return crop ? { crop, planting } : null;
  };

  return {
    current: resolve(selectCurrentPlanting(plantings)),
    previous: resolve(selectPreviousPlanting(plantings)),
  };
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

export type WeatherQueryParams = {
  farmId?: string | null;
  lat?: number | null;
  lng?: number | null;
};

/**
 * The latest real-time weather for the farm or location, or null.
 *
 * Supports passing either a farmId string, an options object with { farmId, lat, lng },
 * or null/undefined (falling back to user profile location).
 */
export async function getWeather(
  input?: string | WeatherQueryParams | null,
): Promise<Weather | null> {
  return orNullWhenAbsent(async () => {
    let query = '';
    if (typeof input === 'string') {
      query = `?farmId=${encodeURIComponent(input)}`;
    } else if (input) {
      const parts: string[] = [];
      if (input.farmId) parts.push(`farmId=${encodeURIComponent(input.farmId)}`);
      if (input.lat !== null && input.lat !== undefined) {
        parts.push(`lat=${encodeURIComponent(String(input.lat))}`);
      }
      if (input.lng !== null && input.lng !== undefined) {
        parts.push(`lng=${encodeURIComponent(String(input.lng))}`);
      }
      query = parts.length ? `?${parts.join('&')}` : '';
    }

    const weather = await apiFetch<Weather>(
      `/api/v1/weather${query}`,
      { fallbackKey: 'home.loadError' },
    );

    return {
      ...weather,
      temperature_c: weather.temperature_c === null ? null : asNumber(weather.temperature_c),
      rainfall_mm: weather.rainfall_mm === null ? null : asNumber(weather.rainfall_mm),
      humidity_pct: weather.humidity_pct === null ? null : asNumber(weather.humidity_pct),
      wind_speed_kmh: weather.wind_speed_kmh === null || weather.wind_speed_kmh === undefined ? null : asNumber(weather.wind_speed_kmh),
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
