// ============================================================
// Yene Verify — Submit Billing DTO (Step 16)
// ============================================================

import { z } from 'zod';

export const SubmitBillingDtoSchema = z
  .object({
    billingSessionId: z.string().uuid('billingSessionId must be a valid UUID'),
    // From POST /receipts/complete (13A): the uploaded screenshot.
    receiptId: z.string().uuid('receiptId must be a valid UUID'),
  })
  .strict();

export type SubmitBillingDto = z.infer<typeof SubmitBillingDtoSchema>;
