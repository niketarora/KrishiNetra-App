import cors from 'cors';
import express, { type Express } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

import { getEnv } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { requestLogger } from './middleware/requestLogger.js';
import { authRouter } from './routes/auth.routes.js';
import { apiRouter } from './routes/index.js';
import { sendOk } from './utils/apiResponse.js';

/**
 * Built as a function so tests can mount the app with supertest without
 * starting a listener.
 */
export function createApp(): Express {
  const env = getEnv();
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: env.corsOrigins, credentials: false }));
  app.use(requestLogger);

  // Increased limit to 10mb for vision base64 image requests.
  app.use(express.json({ limit: '10mb' }));

  // Liveness, not readiness: no database call, so an outage downstream does not
  // make the process look dead.
  app.get('/health', (_req, res) => {
    sendOk(
      res,
      { service: 'krishinetra-backend', status: 'ok', uptimeSeconds: Math.round(process.uptime()) },
      'Service is running',
    );
  });

  // Public auth router — separate from authenticated apiRouter, stricter rate limit
  app.use(
    '/api/v1/auth',
    rateLimit({
      windowMs: 60_000,
      limit: 10,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      handler: (_req, res) => {
        res.status(429).json({
          success: false,
          error: { code: 'INVALID_REQUEST', message: 'Too many authentication attempts. Please slow down.' },
        });
      },
    }),
    authRouter,
  );

  app.use(
    '/api/v1',
    rateLimit({
      windowMs: 60_000,
      limit: 120,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      // Keep the TRD §15 envelope even when the limiter is what answers.
      handler: (_req, res) => {
        res.status(429).json({
          success: false,
          error: { code: 'INVALID_REQUEST', message: 'Too many requests. Please slow down.' },
        });
      },
    }),
    apiRouter,
  );

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
