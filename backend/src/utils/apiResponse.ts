import type { Response } from 'express';

import type { ErrorCode } from './ApiError.js';

/**
 * The TRD §15 envelope, produced in exactly one place so it cannot drift.
 * Nothing else in the codebase calls `res.json` directly.
 */

export type SuccessBody<T> = {
  success: true;
  data: T;
  message: string;
};

export type ErrorBody = {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
  };
};

export function sendOk<T>(res: Response, data: T, message = 'Operation successful'): void {
  const body: SuccessBody<T> = { success: true, data, message };
  res.status(200).json(body);
}

export function sendCreated<T>(res: Response, data: T, message = 'Created'): void {
  const body: SuccessBody<T> = { success: true, data, message };
  res.status(201).json(body);
}

/**
 * Only ever called by the error handler. Carries a code and a safe message and
 * nothing else — no stack, no Postgres text (TRD §15, §23).
 */
export function sendError(res: Response, status: number, code: ErrorCode, message: string): void {
  const body: ErrorBody = { success: false, error: { code, message } };
  res.status(status).json(body);
}
