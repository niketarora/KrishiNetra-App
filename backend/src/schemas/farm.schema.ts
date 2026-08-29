import { z } from 'zod';

import { uuid } from './common.js';

/**
 * The boundary schema mirrors the check constraints in
 * `supabase/migrations/0001_phase1_schema.sql` so a malformed polygon is
 * refused at the API rather than by a Postgres constraint violation the farmer
 * would see as a generic failure.
 */

const longitude = z.number().min(-180).max(180);
const latitude = z.number().min(-90).max(90);

const position = z.tuple([longitude, latitude]);

const linearRing = z
  .array(position)
  // 3 corners + the repeated closing point.
  .min(4, 'A boundary ring needs at least 4 positions.')
  .refine((ring) => {
    const first = ring[0];
    const last = ring[ring.length - 1];
    return !!first && !!last && first[0] === last[0] && first[1] === last[1];
  }, 'The boundary ring must be closed: the first and last positions must match.');

export const boundarySchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z
    .array(linearRing)
    .length(1, 'A farm boundary must be a single ring with no holes.'),
});

const measurements = {
  area_sq_meters: z.number().positive(),
  area_acres: z.number().positive(),
  area_hectares: z.number().positive(),
  centroid_lat: latitude,
  centroid_lng: longitude,
};

const farmName = z.string().trim().max(120).nullish();

const locationAccuracy = z.number().nonnegative().nullish();

/**
 * `user_id` is deliberately absent: it comes from the verified token, never
 * from the body. `.strict()` means a client that sends it gets a 400 rather
 * than having it silently ignored.
 */
export const createFarmSchema = z
  .object({
    name: farmName,
    boundary: boundarySchema,
    location_accuracy: locationAccuracy,
    ...measurements,
  })
  .strict();

/**
 * Note: location_accuracy undefined means keep existing value, null explicitly clears it.
 */
export const updateFarmSchema = z
  .object({
    name: farmName,
    boundary: boundarySchema,
    location_accuracy: locationAccuracy,
    ...measurements,
  })
  .strict();

export const farmIdParamSchema = z.object({
  id: uuid('Not a valid farm id.'),
});

export const listFarmsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export type CreateFarmBody = z.infer<typeof createFarmSchema>;
export type UpdateFarmBody = z.infer<typeof updateFarmSchema>;
