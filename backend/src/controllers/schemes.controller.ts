import type { Request, Response } from 'express';

import { getAuth } from '../middleware/requireAuth.js';
import type { SchemeRowIdParam, SchemesQuery } from '../schemas/scheme.schema.js';
import * as schemes from '../services/schemes.service.js';
import { sendOk } from '../utils/apiResponse.js';

export async function getStates(req: Request, res: Response): Promise<void> {
  const { token } = getAuth(req);
  const data = await schemes.listSchemeStates(token);
  sendOk(res, data, 'States loaded');
}

export async function list(req: Request, res: Response): Promise<void> {
  const { token } = getAuth(req);
  const query = req.query as unknown as SchemesQuery;

  const data = await schemes.listSchemes(token, query);
  sendOk(res, data, 'Schemes loaded');
}

export async function getDetail(req: Request, res: Response): Promise<void> {
  const { token } = getAuth(req);
  const { rowId } = req.params as SchemeRowIdParam;

  const data = await schemes.getSchemeDetail(token, rowId);
  sendOk(res, data, 'Scheme details loaded');
}
