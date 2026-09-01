import { z } from 'zod';

import { uuid } from './common.js';

export const updatesQuerySchema = z
  .object({
    // Optional: a farmer with no registered field yet still gets a feed —
    // see `updates.service.ts::getNationalUpdates`.
    farmId: uuid('Not a valid farm id.').optional(),
  })
  .strict();

export type UpdatesQuery = z.infer<typeof updatesQuerySchema>;
