import { z } from 'zod';

/**
 * Only the fields the app actually edits. `.strict()` rejects anything else,
 * so a client cannot try to set `id`, a timestamp, or a location column —
 * location is read-only from this endpoint until a future GPS/manual entry
 * feature adds its own write path (IMPLEMENTATION.md: don't redesign the
 * location system now).
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
    // Genuinely optional — an empty string is treated the same as omitting
    // it, so the client doesn't have to special-case "clear the field".
    email: z
      .string()
      .trim()
      .max(254)
      .email('Not a valid email address.')
      .nullish()
      .or(z.literal('')),
    language: z.enum(['en', 'hi']).optional(),
    in_app_alerts: z.boolean().optional(),
    sms_alerts: z.boolean().optional(),
    voice_alerts: z.boolean().optional(),
  })
  .strict()
  // Only rewrite `email` when the client actually sent it as ''. Spreading it
  // unconditionally would add an `email: undefined` key to every parse
  // result, including {} — which would break the "nothing to update" check
  // below by making an empty body look non-empty.
  .transform((body) => (body.email === '' ? { ...body, email: null } : body))
  .refine((body) => Object.keys(body).length > 0, 'Nothing to update.');

export type UpdateProfileBody = z.infer<typeof updateProfileSchema>;
