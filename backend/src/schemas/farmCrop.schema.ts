import { z } from 'zod';

import { uuid } from './common.js';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a YYYY-MM-DD date.');

const statusSchema = z.enum(['planned', 'sown', 'growing', 'harvested']);

/**
 * `user_id` and `farm_id` are absent by design: the first comes from the token,
 * the second from the path. `.strict()` turns an attempt to send either into a
 * 400 rather than a silently ignored field.
 */
export const createFarmCropSchema = z
  .object({
    crop_id: uuid('Not a valid crop id.'),
    variety: z.string().trim().max(80).nullish(),
    sown_on: isoDate.nullish(),
    expected_harvest_on: isoDate.nullish(),
    area_acres: z.number().positive().nullish(),
    status: statusSchema.optional(),
    notes: z.string().trim().max(1000).nullish(),
  })
  .strict()
  .refine(
    (body) =>
      !body.sown_on || !body.expected_harvest_on || body.expected_harvest_on >= body.sown_on,
    'The expected harvest date cannot fall before the sowing date.',
  );

export const updateFarmCropSchema = z
  .object({
    crop_id: uuid('Not a valid crop id.').optional(),
    variety: z.string().trim().max(80).nullish(),
    sown_on: isoDate.nullish(),
    expected_harvest_on: isoDate.nullish(),
    area_acres: z.number().positive().nullish(),
    status: statusSchema.optional(),
    notes: z.string().trim().max(1000).nullish(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, 'Nothing to update.');

export const farmCropParamsSchema = z.object({
  farmId: uuid('Not a valid farm id.'),
  cropId: uuid('Not a valid farm crop id.').optional(),
});

export type CreateFarmCropBody = z.infer<typeof createFarmCropSchema>;
export type UpdateFarmCropBody = z.infer<typeof updateFarmCropSchema>;
