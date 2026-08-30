import type { Request, Response } from 'express';

import { getAuth } from '../middleware/requireAuth.js';
import type { ExperimentalSoilMoistureBody } from '../schemas/prediction.schema.js';
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
