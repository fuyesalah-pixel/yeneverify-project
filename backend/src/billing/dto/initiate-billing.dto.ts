// ============================================================
// Yene Verify — Initiate Billing DTO (Step 16)
// ============================================================

import { z } from 'zod';

export const InitiateBillingDtoSchema = z
  .object({
    packageCode: z.enum(['FREE', 'PREMIUM', 'BUSINESS', 'BUSINESS_PRO']),
  })
  .refine((v) => v.packageCode !== 'FREE', {
    path: ['packageCode'],
    message: 'FREE is auto-provisioned at onboarding and cannot be purchased',
  });

export type InitiateBillingDto = z.infer<typeof InitiateBillingDtoSchema>;
