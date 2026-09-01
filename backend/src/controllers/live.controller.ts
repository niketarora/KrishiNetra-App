import type { Request, Response } from 'express';

import { createLiveSessionToken } from '../ai/live.service.js';
import { getAuth } from '../middleware/requireAuth.js';
import { sendOk } from '../utils/apiResponse.js';

/**
 * Issues short-lived live session credentials for Gemini Multimodal Live API.
 */
export async function getLiveToken(req: Request, res: Response): Promise<void> {
  getAuth(req);
  const sessionConfig = await createLiveSessionToken();
  sendOk(res, sessionConfig, 'Live session token issued');
}
