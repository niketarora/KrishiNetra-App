import type { Request, Response } from 'express';

import { getAuth } from '../middleware/requireAuth.js';
import type { UpdateProfileBody } from '../schemas/profile.schema.js';
import * as profiles from '../services/profiles.service.js';
import { sendOk } from '../utils/apiResponse.js';

/**
 * There is no `/farmers/:id`. A farmer can only ever read themselves, so the
 * identity comes from the token and the route has nothing to address.
 */

export async function getMe(req: Request, res: Response): Promise<void> {
  const { token, userId } = getAuth(req);

  const data = await profiles.getProfile(token, userId);
  sendOk(res, data, 'Profile loaded');
}

export async function updateMe(req: Request, res: Response): Promise<void> {
  const { token, userId } = getAuth(req);

  const data = await profiles.updateProfile(token, userId, req.body as UpdateProfileBody);
  sendOk(res, data, 'Profile updated');
}
