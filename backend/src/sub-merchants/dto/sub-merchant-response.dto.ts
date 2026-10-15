// ============================================================
// Yene Verify — Sub-Merchant Response DTOs
// ============================================================

import { z } from 'zod';

export const SubMerchantResponseDtoSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(['SUB_MERCHANT', 'INVITE']),
  status: z.enum([
    'INVITED',
    'ACTIVE',
    'SUSPENDED',
    'REMOVED',
    'PENDING',
    'ACCEPTED',
    'DECLINED',
    'EXPIRED',
    'REVOKED',
  ]),
  name: z.string(),
  phone: z.string(),
  branchLabel: z.string().nullable().optional(),
  invitedAt: z.string().datetime().nullable().optional(),
  joinedAt: z.string().datetime().nullable().optional(),
  verificationCount: z.number().int().optional(),
  lastVerificationAt: z.string().datetime().nullable().optional(),
});

export type SubMerchantResponseDto = z.infer<typeof SubMerchantResponseDtoSchema>;

export const SubMerchantDetailDtoSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(['SUB_MERCHANT', 'INVITE']),
  status: z.enum([
    'INVITED',
    'ACTIVE',
    'SUSPENDED',
    'REMOVED',
    'PENDING',
    'ACCEPTED',
    'DECLINED',
    'EXPIRED',
    'REVOKED',
  ]),
  name: z.string(),
  phone: z.string(),
  branchLabel: z.string().nullable().optional(),
  invitedAt: z.string().datetime().nullable().optional(),
  joinedAt: z.string().datetime().nullable().optional(),
  inviterName: z.string().nullable().optional(),
  verificationCount: z.number().int().default(0),
  lastVerificationAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type SubMerchantDetailDto = z.infer<typeof SubMerchantDetailDtoSchema>;
