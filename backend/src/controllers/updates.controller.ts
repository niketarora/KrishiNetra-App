import type { Request, Response } from 'express';

import { getAuth } from '../middleware/requireAuth.js';
import { getNationalUpdates, getUpdatesForFarm } from '../updates/updates.service.js';
import { sendOk } from '../utils/apiResponse.js';

/**
 * Krishi Updates — a location-and-crop-aware information feed for one farm.
 * `getUpdatesForFarm` verifies ownership through `farms.service.getFarm`
 * before touching any provider, the same way `farmCrops.controller` and the
 * `weather` endpoint do. `farmId` is optional: a farmer with no registered
 * field yet gets the national feed instead of an error.
 */
export async function list(req: Request, res: Response): Promise<void> {
  const { token, userId } = getAuth(req);
  const { farmId } = req.query as { farmId?: string };

  const { updates } = farmId
    ? await getUpdatesForFarm(token, userId, farmId)
    : await getNationalUpdates();

  sendOk(res, updates, updates.length === 0 ? 'No relevant updates right now' : 'Updates loaded');
}
