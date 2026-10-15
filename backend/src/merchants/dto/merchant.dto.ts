// ============================================================
// Yene Verify — Merchant DTOs
// ============================================================

import { z } from 'zod';

export const UpdateMerchantDtoSchema = z.object({
  businessName: z.string().min(1).max(80).trim().optional(),
  businessType: z.string().max(100).optional(),
  tin: z.string().max(20).optional(),
  address: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  region: z.string().max(100).optional(),
});

export type UpdateMerchantDto = z.infer<typeof UpdateMerchantDtoSchema>;

export const MerchantResponseDtoSchema = z.object({
  id: z.string().uuid(),
  businessName: z.string(),
  businessType: z.string().nullable().optional(),
  tin: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  region: z.string().nullable().optional(),
  status: z.enum(['PENDING', 'ACTIVE', 'SUSPENDED', 'BANNED']),
  creditsBalance: z.string(), // BigInt as string
  creditsUpdatedAt: z.string().datetime().nullable().optional(),
  currentPackageCode: z
    .enum(['FREE', 'PREMIUM', 'BUSINESS', 'BUSINESS_PRO', 'API'])
    .nullable()
    .optional(),
  subscriptionId: z.string().uuid().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable().optional(),
});

export type MerchantResponseDto = z.infer<typeof MerchantResponseDtoSchema>;
