import type { Request, Response } from 'express';

import { getAuth } from '../middleware/requireAuth.js';
import type { ExperimentalSoilMoistureBody } from '../schemas/prediction.schema.js';
import { getFarmSoilMoisturePrediction as runFarmSoilMoisture } from '../services/farmPredictions.service.js';
import { predictSoilMoisture as runSoilMoistureModel } from '../services/soilMoisturePrediction.service.js';
import { sendOk } from '../utils/apiResponse.js';

/**
 * Experimental model access remains authenticated even though this artifact
 * does not yet consume farmer-owned rows. This keeps the ML service private and
 * preserves the mobile -> backend -> ML architecture.
 */
export async function predictSoilMoisture(req: Request, res: Response): Promise<void> {
  getAuth(req);

  const prediction = await runSoilMoistureModel(
    req.body as ExperimentalSoilMoistureBody,
  );

  sendOk(res, prediction, 'Experimental soil-moisture prediction generated');
}

export async function getFarmSoilMoisturePrediction(req: Request, res: Response): Promise<void> {
  const { token, userId } = getAuth(req);
  const farmId = req.params.farmId as string;

  const result = await runFarmSoilMoisture(token, userId, farmId);

  sendOk(res, result, 'Farm soil-moisture prediction retrieved');
}
