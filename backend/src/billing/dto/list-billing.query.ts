// ============================================================
// Yene Verify — List Billing Query DTO (Step 16)
// ============================================================

import { z } from 'zod';

export const BILLING_STATUSES = [
  'PENDING',
  'VERIFIED',
  'AMOUNT_MISMATCH',
  'DUPLICATE',
  'FAKE',
  'NEEDS_REVIEW',
  'APPROVED',
  'REJECTED',
] as const;

export const BillingQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(BILLING_STATUSES).optional(),
});

export type BillingQuery = z.infer<typeof BillingQuerySchema>;
