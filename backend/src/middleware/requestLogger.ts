import { randomUUID } from 'node:crypto';

import type { NextFunction, Request, Response } from 'express';

/**
 * Stamps every request with an id and logs how it finished. The id is echoed in
 * the response header and included in every error log, so a farmer-reported
 * failure can be traced without exposing anything in the response body.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const requestId = req.header('x-request-id') ?? randomUUID();
  res.setHeader('x-request-id', requestId);

  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    console.info(
      `[req] ${requestId} ${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(1)}ms`,
    );
  });

  next();
}
