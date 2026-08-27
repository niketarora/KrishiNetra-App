import type { Request, Response } from 'express';

import { getAuth } from '../middleware/requireAuth.js';
import type { CreateFarmBody, UpdateFarmBody } from '../schemas/farm.schema.js';
import * as farms from '../services/farms.service.js';
import { sendCreated, sendOk } from '../utils/apiResponse.js';

/** HTTP in, HTTP out. No Supabase client is imported here by design. */

export async function list(req: Request, res: Response): Promise<void> {
  const { token, userId } = getAuth(req);
  const { limit } = req.query as { limit?: number };

  const data = await farms.listFarms(token, userId, limit);
  sendOk(res, data, 'Fields loaded');
}

export async function getOne(req: Request, res: Response): Promise<void> {
  const { token, userId } = getAuth(req);
  const { id } = req.params as { id: string };

  const data = await farms.getFarm(token, userId, id);
  sendOk(res, data, 'Field loaded');
}

export async function create(req: Request, res: Response): Promise<void> {
  const { token, userId } = getAuth(req);

  const data = await farms.createFarm(token, userId, req.body as CreateFarmBody);
  sendCreated(res, data, 'Field saved');
}

export async function update(req: Request, res: Response): Promise<void> {
  const { token, userId } = getAuth(req);
  const { id } = req.params as { id: string };

  const data = await farms.updateFarm(token, userId, id, req.body as UpdateFarmBody);
  sendOk(res, data, 'Field updated');
}
