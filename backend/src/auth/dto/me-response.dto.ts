// ============================================================
// Yene Verify — Me Response DTO
// ============================================================

import { z } from 'zod';

export const MeResponseDtoSchema = z.object({
  id: z.string().uuid(),
  phone: z.string(),
  phoneVerifiedAt: z.string().datetime().nullable().optional(),
  fullName: z.string(),
  role: z.enum(['ADMIN', 'MERCHANT', 'SUB_MERCHANT']),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'BANNED', 'DELETED']),
  preferredLanguage: z.enum(['en', 'am']),
  lastLoginAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  needsPinSetup: z.boolean(),
  needsOnboarding: z.boolean(),
  device: z
    .object({
      id: z.string().uuid(),
      fingerprint: z.string(),
      platform: z.enum(['ANDROID', 'IOS']),
    })
    .optional(),
});

export type MeResponseDto = z.infer<typeof MeResponseDtoSchema>;
