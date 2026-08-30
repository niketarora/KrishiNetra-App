import type { Request, Response } from 'express';

import { getAuth } from '../middleware/requireAuth.js';
import { getUpdatesForFarm } from '../updates/updates.service.js';
import { sendOk } from '../utils/apiResponse.js';

/**
 * Krishi Updates — a location-and-crop-aware information feed for one farm.
 * `getUpdatesForFarm` verifies ownership through `farms.service.getFarm`
 * before touching any provider, the same way `farmCrops.controller` and the
 * `weather` endpoint do.
 */
export async function list(req: Request, res: Response): Promise<void> {
  const { token, userId } = getAuth(req);
  const { farmId } = req.query as { farmId: string };

  const { updates } = await getUpdatesForFarm(token, userId, farmId);

  sendOk(res, updates, updates.length === 0 ? 'No relevant updates right now' : 'Updates loaded');
}
