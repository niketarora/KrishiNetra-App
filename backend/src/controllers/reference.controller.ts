import type { Request, Response } from 'express';

import { adminClient } from '../config/supabase.js';
import { normalizeWeatherResponse } from '../ingestion/weather/weatherNormalizer.js';
import { fetchObservedWeather, weatherSourceLabel } from '../ingestion/weather/weatherSource.js';
import { getAuth } from '../middleware/requireAuth.js';
import * as farms from '../services/farms.service.js';
import * as reference from '../services/reference.service.js';
import type { WeatherRow } from '../types/domain.js';
import { ApiError } from '../utils/ApiError.js';
import { sendOk } from '../utils/apiResponse.js';

/**
 * IMPLEMENTATION.md rule 13 governs this file: an endpoint over an empty table
 * says so plainly and returns nothing. It never returns a plausible number.
 */

export const NOT_CONNECTED = {
  marketPrices: 'Market price data is not connected yet.',
  weather: 'Weather data is not connected yet.',
} as const;

export async function crops(req: Request, res: Response): Promise<void> {
  const { token } = getAuth(req);

  const data = await reference.listCrops(token);
  sendOk(res, data, 'Crops loaded');
}

export async function mandis(req: Request, res: Response): Promise<void> {
  const { token } = getAuth(req);
  const { state, district } = req.query as { state?: string; district?: string };

  const data = await reference.listMandis(token, { state, district });
  sendOk(res, data, 'Mandis loaded');
}

export async function msp(req: Request, res: Response): Promise<void> {
  const { token } = getAuth(req);
  const { crop, year } = req.query as { crop?: string; year?: string };

  const data = await reference.listMsp(token, { crop, year });
  sendOk(res, data, 'MSP loaded');
}

/**
 * Phase 2.5 connected the AGMARKNET ingester, so this now returns real
 * observations. When a filter matches nothing — a crop with no coverage, a
 * date range before ingestion started — it still returns an empty array and
 * says the data is not connected, rather than widening the query until
 * something comes back.
 */
export async function marketPrices(req: Request, res: Response): Promise<void> {
  const { token } = getAuth(req);
  const filters = req.query as {
    crop?: string;
    mandi?: string;
    from?: string;
    to?: string;
    limit?: number;
  };

  const data = await reference.listMarketPrices(token, filters);

  sendOk(res, data, data.length === 0 ? NOT_CONNECTED.marketPrices : 'Market prices loaded');
}

const inFlightWeather = new Map<string, Promise<WeatherRow | null>>();
const negativeResultCache = new Map<string, number>();
const NEGATIVE_CACHE_TTL_MS = 5 * 60 * 1000;

function snapGrid(coord: number): number {
  return Math.round(coord * 4) / 4;
}

function gridKey(lat: number, lng: number): string {
  return `${lat}:${lng}`;
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

async function fetchAndStoreGridWeather(
  gridLat: number,
  gridLng: number,
): Promise<WeatherRow | null> {
  const payload = await fetchObservedWeather({
    latitude: gridLat,
    longitude: gridLng,
    startDate: isoDaysAgo(14),
    endDate: isoDaysAgo(0),
  });

  const { rows } = normalizeWeatherResponse(payload);
  if (rows.length === 0) return null;

  const source = weatherSourceLabel();
  const db = adminClient();

  try {
    await db.from('weather').upsert(
      rows.map((row) => ({
        grid_lat: gridLat,
        grid_lng: gridLng,
        observed_on: row.observed_on,
        temperature_c: row.temperature_c,
        rainfall_mm: row.rainfall_mm,
        humidity_pct: row.humidity_pct,
        source,
      })),
      { onConflict: 'grid_lat,grid_lng,observed_on' },
    );
  } catch {
    // Non-fatal if remote DB schema migration 0006 has not been executed yet
  }

  const latest = rows[rows.length - 1];
  if (!latest) return null;

  return {
    id: `grid-${gridLat}-${gridLng}-${latest.observed_on}`,
    grid_lat: gridLat,
    grid_lng: gridLng,
    district: null,
    state: null,
    observed_on: latest.observed_on,
    temperature_c: latest.temperature_c,
    rainfall_mm: latest.rainfall_mm,
    humidity_pct: latest.humidity_pct,
    source,
    created_at: new Date().toISOString(),
  };
}

/**
 * The latest observation for the farm's 0.25° grid cell.
 *
 * If no observation is stored yet, an on-demand fetch queries Open-Meteo's
 * archive for the grid cell centre, upserts the rows, and returns the latest.
 *
 * If no data is available from the provider, 503 SERVICE_NOT_CONNECTED is returned.
 */
export async function weather(req: Request, res: Response): Promise<void> {
  const { token, userId } = getAuth(req);
  const { farmId } = req.query as { farmId?: string };

  if (!farmId) throw ApiError.notConnected(NOT_CONNECTED.weather);

  const farm = await farms.getFarm(token, userId, farmId);
  if (farm.centroid_lat === null || farm.centroid_lng === null) {
    throw ApiError.notConnected(NOT_CONNECTED.weather);
  }

  const gridLat = snapGrid(farm.centroid_lat);
  const gridLng = snapGrid(farm.centroid_lng);
  const key = gridKey(gridLat, gridLng);

  let observation = await reference.latestWeatherForGridCell(token, gridLat, gridLng);

  if (!observation) {
    const lastNegative = negativeResultCache.get(key);
    const now = Date.now();
    if (!lastNegative || now - lastNegative > NEGATIVE_CACHE_TTL_MS) {
      if (!inFlightWeather.has(key)) {
        const fetchPromise = (async () => {
          try {
            const inMemory = await fetchAndStoreGridWeather(gridLat, gridLng);
            const fresh = await reference.latestWeatherForGridCell(token, gridLat, gridLng);
            const result = fresh ?? inMemory;
            if (!result) {
              negativeResultCache.set(key, Date.now());
            }
            return result;
          } catch {
            negativeResultCache.set(key, Date.now());
            return null;
          } finally {
            inFlightWeather.delete(key);
          }
        })();
        inFlightWeather.set(key, fetchPromise);
      }

      observation = await inFlightWeather.get(key)!;
    }
  }

  if (!observation) throw ApiError.notConnected(NOT_CONNECTED.weather);

  sendOk(res, observation, 'Weather loaded');
}
