import { z } from 'zod';

export const schemesQuerySchema = z
  .object({
    state: z.string().trim().min(1, 'State is required.'),
    cropCode: z.string().trim().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50).optional(),
    offset: z.coerce.number().int().min(0).default(0).optional(),
  })
  .strict();

export const schemeRowIdParamSchema = z
  .object({
    rowId: z.string().trim().min(1, 'Not a valid scheme row id.'),
  })
  .strict();

export type SchemesQuery = z.infer<typeof schemesQuerySchema>;
export type SchemeRowIdParam = z.infer<typeof schemeRowIdParamSchema>;
