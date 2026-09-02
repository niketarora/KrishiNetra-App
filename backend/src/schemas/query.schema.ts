import { z } from 'zod';

import { uuid } from './common.js';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a YYYY-MM-DD date.');

export const mandisQuerySchema = z
  .object({
    state: z.string().trim().max(60).optional(),
    district: z.string().trim().max(60).optional(),
  })
  .strict();

export const marketPricesQuerySchema = z
  .object({
    crop: z.string().trim().max(60).optional(),
    mandi: z.string().trim().max(60).optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
  })
  .strict()
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    message: '`from` cannot fall after `to`.',
  });

export const mspQuerySchema = z
  .object({
    crop: z.string().trim().max(60).optional(),
    year: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}$/, 'Expected a marketing year such as 2025-26.')
      .optional(),
  })
  .strict();

export const weatherQuerySchema = z
  .object({
    farmId: uuid('Not a valid farm id.').optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
  })
  .strict();
