import type { NextFunction, Request, Response } from 'express';

import { authClient } from '../config/supabase.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * The farmer's identity, established from the Bearer token and nowhere else.
 * Controllers read `userId` from here rather than from any request body.
 */
export type AuthContext = {
  userId: string;
  token: string;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

function readBearerToken(header: string | undefined): string | null {
  if (!header) return null;

  const [scheme, token] = header.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer') return null;
  if (!token || token.trim().length === 0) return null;

  return token.trim();
}

/**
 * Verifies the Supabase access token the app already holds. The backend never
 * issues tokens and never sees a password: authentication stays in Supabase
 * Auth on the client, and this layer only checks who is calling.
 */
export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const token = readBearerToken(req.header('authorization'));

  if (!token) {
    next(ApiError.unauthenticated('A bearer token is required.'));
    return;
  }

  try {
    const { data, error } = await authClient().auth.getUser(token);

    if (error || !data?.user) {
      next(ApiError.unauthenticated('That session is not valid. Please sign in again.'));
      return;
    }

    req.auth = { userId: data.user.id, token };
    next();
  } catch (cause) {
    next(cause);
  }
}

/** Narrow `req.auth` for controllers, which only run behind requireAuth. */
export function getAuth(req: Request): AuthContext {
  if (!req.auth) {
    // Unreachable through the router. Guards against a route being mounted
    // without requireAuth in front of it.
    throw ApiError.unauthenticated();
  }
  return req.auth;
}
