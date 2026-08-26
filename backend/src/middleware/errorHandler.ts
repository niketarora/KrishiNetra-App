import type { NextFunction, Request, Response } from 'express';

import { ApiError, isApiError, type ErrorCode } from '../utils/ApiError.js';
import { sendError } from '../utils/apiResponse.js';

/**
 * The single exit for every failure.
 *
 * The real error is logged server-side with the request id; the client gets a
 * code and a safe sentence. Never a stack trace, never a Postgres or PostgREST
 * message (TRD §15, §23). The mobile app depends on this: it maps the code onto
 * translated copy, and a farmer must never see an internal string.
 */

type PostgrestLike = {
  code?: string;
  message?: string;
  details?: string;
};

/** Recognise the Postgres failures worth reporting as something specific. */
function fromPostgres(error: PostgrestLike): ApiError | null {
  switch (error.code) {
    case '23505':
      return ApiError.conflict();
    case '23503':
      return ApiError.invalidRequest('That record refers to something that does not exist.');
    case '23514':
      return ApiError.invalidRequest('That value is not allowed.');
    case '42501':
      // RLS refused the write. Ownership was already checked, so this means the
      // caller genuinely has no right to the row.
      return new ApiError('FORBIDDEN', 'You do not have access to that record.');
    case 'PGRST116':
      return ApiError.notFound();
    default:
      return null;
  }
}

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  const requestId = res.getHeader('x-request-id');
  const apiError = isApiError(error)
    ? error
    : fromPostgres((error ?? {}) as PostgrestLike) ??
      new ApiError('INTERNAL_ERROR', 'Something went wrong. Please try again.');

  // Everything unexpected, and every 5xx, is worth a full server-side log.
  if (!isApiError(error) || apiError.status >= 500) {
    console.error('[error]', {
      requestId,
      method: req.method,
      path: req.originalUrl,
      code: apiError.code,
      error,
    });
  } else {
    console.warn('[warn]', {
      requestId,
      method: req.method,
      path: req.originalUrl,
      code: apiError.code,
      message: apiError.message,
    });
  }

  const code: ErrorCode = apiError.code;
  sendError(res, apiError.status, code, apiError.message);
}
