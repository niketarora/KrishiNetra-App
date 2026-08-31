import type { Request, Response } from 'express';

import { assist as runAssist } from '../ai/orchestrator.service.js';
import { getAuth } from '../middleware/requireAuth.js';
import type { AssistBody } from '../schemas/assistant.schema.js';
import { sendOk } from '../utils/apiResponse.js';

/**
 * The in-app guide's one endpoint.
 *
 * Thin on purpose: the routing decision, the provider choice and the response
 * shape all belong to the orchestrator. This validates that a farmer is asking
 * and hands the answer back in the standard envelope.
 */
export async function assist(req: Request, res: Response): Promise<void> {
  const { token, userId } = getAuth(req);
  const body = req.body as AssistBody;

  const response = await runAssist({
    transcript: body.transcript,
    language: body.language,
    token,
    userId,
  });

  sendOk(res, response, 'Assisted');
}
