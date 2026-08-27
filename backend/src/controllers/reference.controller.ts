import type { Request, Response } from 'express';

import { getAuth } from '../middleware/requireAuth.js';
import * as farms from '../services/farms.service.js';
import * as reference from '../services/reference.service.js';
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

/**
 * The latest observation for the farm's district.
 *
 * Phase 2.5 gave this a real provider, but the 503 path is unchanged and still
 * matters. Three things can go missing — the farm's district was never
 * resolved, no observation has been ingested for it, or the row exists but
 * carries no measurements — and every one of them answers "not connected"
 * rather than a number.
 *
 * That asymmetry with market prices is deliberate: an empty price *list* is a
 * coherent answer, but there is no such thing as "no weather", so an empty
 * reading would read as a broken tile rather than an honest one.
 */
export async function weather(req: Request, res: Response): Promise<void> {
  const { token, userId } = getAuth(req);
  const { farmId } = req.query as { farmId?: string };

  // No farm means no location to resolve, which is the same answer as an
  // unresolved district: unavailable, not an invented reading.
  if (!farmId) throw ApiError.notConnected(NOT_CONNECTED.weather);

  // Ownership is enforced here exactly as it is everywhere else: this throws
  // 404 for a farm that is not the caller's.
  const farm = await farms.getFarm(token, userId, farmId);

  // §3.3: no district means no reliable location, and a guess is forbidden.
  if (!farm.district || !farm.state) throw ApiError.notConnected(NOT_CONNECTED.weather);

  const observation = await reference.latestWeatherForDistrict(token, farm.district, farm.state);
  if (!observation) throw ApiError.notConnected(NOT_CONNECTED.weather);

  sendOk(res, observation, 'Weather loaded');
}
