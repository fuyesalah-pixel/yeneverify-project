// ============================================================
// Yene Verify — Reset PIN DTO
// ============================================================

import { z } from 'zod';

export const ResetPinDtoSchema = z.object({
  phone: z
    .string()
    .min(1, 'Phone is required')
    .regex(/^\+251[0-9]{9}$/, 'Phone must be a valid Ethiopian number (+251 format)'),
  otpCode: z
    .string()
    .length(6, 'OTP must be 6 digits')
    .regex(/^\d{6}$/, 'OTP must be 6 digits'),
  device: z.object({
    fingerprint: z.string().min(1, 'Device fingerprint is required'),
    platform: z.enum(['ANDROID', 'IOS']),
    model: z.string().max(100).optional(),
    osVersion: z.string().max(50).optional(),
    appVersion: z.string().max(50).optional(),
    pushToken: z.string().max(500).optional(),
  }),
});

export type ResetPinDto = z.infer<typeof ResetPinDtoSchema>;
