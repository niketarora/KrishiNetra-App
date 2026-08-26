import type { Request, Response } from 'express';

import { getAuth } from '../middleware/requireAuth.js';
import type { CreateFarmCropBody, UpdateFarmCropBody } from '../schemas/farmCrop.schema.js';
import * as farmCrops from '../services/farmCrops.service.js';
import { sendCreated, sendOk } from '../utils/apiResponse.js';

export async function list(req: Request, res: Response): Promise<void> {
  const { token, userId } = getAuth(req);
  const { farmId } = req.params as { farmId: string };

  const data = await farmCrops.listFarmCrops(token, userId, farmId);
  sendOk(res, data, 'Crops loaded');
}

export async function create(req: Request, res: Response): Promise<void> {
  const { token, userId } = getAuth(req);
  const { farmId } = req.params as { farmId: string };

  const data = await farmCrops.createFarmCrop(
    token,
    userId,
    farmId,
    req.body as CreateFarmCropBody,
  );
  sendCreated(res, data, 'Crop added');
}

export async function update(req: Request, res: Response): Promise<void> {
  const { token, userId } = getAuth(req);
  const { farmId, cropId } = req.params as { farmId: string; cropId: string };

  const data = await farmCrops.updateFarmCrop(
    token,
    userId,
    farmId,
    cropId,
    req.body as UpdateFarmCropBody,
  );
  sendOk(res, data, 'Crop updated');
}
