// ============================================================
// Yene Verify — Biometric Step-Up DTO
// ============================================================

import { z } from 'zod';

export const BiometricStepUpDtoSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
  device: z.object({
    fingerprint: z.string().min(1, 'Device fingerprint is required'),
    platform: z.enum(['ANDROID', 'IOS']),
    model: z.string().max(100).optional(),
    osVersion: z.string().max(50).optional(),
    appVersion: z.string().max(50).optional(),
    pushToken: z.string().max(500).optional(),
  }),
});

export type BiometricStepUpDto = z.infer<typeof BiometricStepUpDtoSchema>;
