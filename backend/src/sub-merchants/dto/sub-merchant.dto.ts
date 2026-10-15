// ============================================================
// Yene Verify — Sub-Merchant DTOs
// ============================================================

import { z } from 'zod';

export const InviteSubMerchantDtoSchema = z.object({
  phone: z
    .string()
    .min(1, 'Phone is required')
    .regex(/^\+251[0-9]{9}$/, 'Phone must be a valid Ethiopian number (+251 format)'),
  name: z.string().max(100).optional(),
  branchLabel: z.string().max(50).optional(),
});

export type InviteSubMerchantDto = z.infer<typeof InviteSubMerchantDtoSchema>;

export const AcceptInviteDtoSchema = z.object({
  token: z.string().min(1, 'Invite token is required'),
});

export type AcceptInviteDto = z.infer<typeof AcceptInviteDtoSchema>;

export const DeclineInviteDtoSchema = z.object({
  token: z.string().min(1, 'Invite token is required'),
});

export type DeclineInviteDto = z.infer<typeof DeclineInviteDtoSchema>;

export const UpdateSubMerchantDtoSchema = z.object({
  branchLabel: z.string().max(50).optional(),
});

export type UpdateSubMerchantDto = z.infer<typeof UpdateSubMerchantDtoSchema>;

export const SubMerchantListQueryDtoSchema = z.object({
  status: z.enum(['INVITED', 'ACTIVE', 'SUSPENDED', 'REMOVED']).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export type SubMerchantListQueryDto = z.infer<typeof SubMerchantListQueryDtoSchema>;
