import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodType } from 'zod';

import { ApiError } from '../utils/ApiError.js';

type Source = 'body' | 'query' | 'params';

/**
 * Turns a zod failure into a 400 with a field-level message that is safe to
 * show. The message names the field and what was wrong with it, and nothing
 * about the server.
 */
function toApiError(error: unknown): ApiError {
  const issues = (error as { issues?: { path: (string | number)[]; message: string }[] }).issues;

  if (!issues?.length) {
    return ApiError.invalidRequest();
  }

  const details = issues.map((issue) => ({
    field: issue.path.join('.') || '(root)',
    message: issue.message,
  }));

  const first = details[0]!;
  const message =
    first.field === '(root)' ? first.message : `${first.field}: ${first.message}`;

  return ApiError.invalidRequest(message, details);
}

/**
 * Validate one part of the request and replace it with the parsed value, so a
 * controller receives coerced types (numbers from query strings, trimmed
 * strings) rather than raw input.
 */
export function validate(source: Source, schema: ZodType): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      next(toApiError(result.error));
      return;
    }

    // Express 5 makes `req.query` a getter, so it is assigned via
    // defineProperty rather than mutated.
    if (source === 'query') {
      Object.defineProperty(req, 'query', { value: result.data, writable: true });
    } else {
      req[source] = result.data as never;
    }

    next();
  };
}
