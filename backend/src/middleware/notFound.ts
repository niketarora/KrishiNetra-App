import type { NextFunction, Request, Response } from 'express';

import { ApiError } from '../utils/ApiError.js';

/**
 * Anything that reaches here is a route that does not exist. The prefixes TRD
 * §14 reserves for later phases — /buyers, /lots, /offers, /predictions and the
 * rest — deliberately fall through to this rather than being stubbed.
 */
export function notFound(req: Request, _res: Response, next: NextFunction): void {
  next(ApiError.notFound(`No route for ${req.method} ${req.originalUrl}.`));
}
