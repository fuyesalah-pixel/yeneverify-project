// ============================================================
// Yene Verify — List Exports Query (Step 19)
//
// GET /exports pagination + optional status filter.
// ============================================================

import { z } from 'zod';

export const ListExportsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(50).default(20).optional(),
    status: z.enum(['QUEUED', 'PROCESSING', 'READY', 'FAILED', 'EXPIRED']).optional(),
  })
  .strict();

export type ListExportsQuery = z.infer<typeof ListExportsQuerySchema>;
