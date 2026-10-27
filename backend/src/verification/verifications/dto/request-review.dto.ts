// ============================================================
// Yene Verify — Request Review DTO (13E.3)
// ============================================================

import { z } from 'zod';

export const RequestReviewDtoSchema = z.object({
  reason: z.string().min(1, 'reason is required').max(500, 'reason must be at most 500 characters'),
});

export type RequestReviewDto = z.infer<typeof RequestReviewDtoSchema>;
