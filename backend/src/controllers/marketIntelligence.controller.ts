import type { Request, Response } from 'express';
import { getAuth } from '../middleware/requireAuth.js';
import type { MarketIntelligenceAnalyseInput } from '../schemas/marketIntelligence.schema.js';
import { MarketIntelligenceService } from '../services/marketIntelligence.service.js';
import { sendOk } from '../utils/apiResponse.js';

const marketIntelligenceService = new MarketIntelligenceService();

export async function analyseMarketIntelligence(req: Request, res: Response): Promise<void> {
  getAuth(req);

  const body = req.body as MarketIntelligenceAnalyseInput;
  const result = await marketIntelligenceService.analyse(body);

  sendOk(res, result, 'Crop market price intelligence and forecasting generated');
}

export async function analyseMarketIntelligencePublic(req: Request, res: Response): Promise<void> {
  const body = req.body as MarketIntelligenceAnalyseInput;
  const result = await marketIntelligenceService.analyse(body);

  sendOk(res, result, 'Crop market price intelligence generated');
}
