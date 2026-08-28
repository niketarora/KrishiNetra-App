/**
 * The error codes the API is allowed to return (docs/PHASE2_IMPLEMENTATION.md
 * §7.4). The mobile client maps these onto translated copy, so adding one here
 * means adding a case to `mobile/src/services/errors.ts`.
 */
export const ERROR_CODES = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INVALID_REQUEST: 400,
  CONFLICT: 409,
  SERVICE_NOT_CONNECTED: 503,
  INTERNAL_ERROR: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

/** Thrown by controllers and services. The error handler turns it into JSON. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = ERROR_CODES[code];
    this.details = details;
  }

  static unauthenticated(message = 'Authentication is required.'): ApiError {
    return new ApiError('UNAUTHENTICATED', message);
  }

  static notFound(message = 'Not found.'): ApiError {
    return new ApiError('NOT_FOUND', message);
  }

  static invalidRequest(message = 'Invalid request.', details?: unknown): ApiError {
    return new ApiError('INVALID_REQUEST', message, details);
  }

  static conflict(message = 'That record already exists.'): ApiError {
    return new ApiError('CONFLICT', message);
  }

  static notConnected(message: string): ApiError {
    return new ApiError('SERVICE_NOT_CONNECTED', message);
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
