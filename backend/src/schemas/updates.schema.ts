import { z } from 'zod';

import { uuid } from './common.js';

export const updatesQuerySchema = z
  .object({
    farmId: uuid('Not a valid farm id.'),
  })
  .strict();

export type UpdatesQuery = z.infer<typeof updatesQuerySchema>;
