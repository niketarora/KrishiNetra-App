import { z } from 'zod';

/**
 * Only the three fields the app actually edits. `.strict()` rejects anything
 * else, so a client cannot try to set `id` or a timestamp.
 */
export const updateProfileSchema = z
  .object({
    full_name: z.string().trim().min(1).max(120).nullish(),
    phone: z
      .string()
      .trim()
      .max(20)
      .regex(/^[0-9+\-\s()]*$/, 'Not a valid phone number.')
      .nullish(),
    language: z
      .enum([
        'en',
        'hi',
        'bn',
        'mr',
        'te',
        'ta',
        'gu',
        'ur',
        'kn',
        'or',
        'ml',
        'pa',
        'as',
        'mai',
        'sat',
        'ks',
        'ne',
        'kok',
        'sd',
        'doi',
        'mni',
        'brx',
        'sa',
      ])
      .optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, 'Nothing to update.');

export type UpdateProfileBody = z.infer<typeof updateProfileSchema>;
