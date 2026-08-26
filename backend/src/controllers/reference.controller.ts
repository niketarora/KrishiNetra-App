import type { Request, Response } from 'express';

import { getAuth } from '../middleware/requireAuth.js';
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
 * The table is empty in Phase 2, so this returns an empty array and says why.
 * The query itself is real: it starts returning rows the moment Phase 3
 * ingests AGMARKNET data, with no change here.
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
 * Weather has no provider in Phase 2, so this is a 503 rather than an empty
 * reading.
 *
 * The difference from market prices is deliberate: an empty price *list* is a
 * coherent answer — no sales were recorded — but there is no such thing as "no
 * weather". Reporting the service as unavailable is the honest response, and it
 * is what the Home screen's existing "Available in a future update" tile
 * already expects.
 */
export async function weather(req: Request, res: Response): Promise<void> {
  getAuth(req);
  throw ApiError.notConnected(NOT_CONNECTED.weather);
}
