// ============================================================
// Yene Verify — Create Merchant DTO
// ============================================================

import { z } from 'zod';

export const CreateMerchantDtoSchema = z.object({
  businessName: z
    .string()
    .min(1, 'Business name is required')
    .max(80, 'Business name must be 80 characters or less')
    .trim(),
  businessType: z.string().max(100).optional(),
  tin: z.string().max(20).optional(),
  address: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  region: z.string().max(100).optional(),
});

export type CreateMerchantDto = z.infer<typeof CreateMerchantDtoSchema>;
