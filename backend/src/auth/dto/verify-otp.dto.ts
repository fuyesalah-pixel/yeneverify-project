// ============================================================
// Yene Verify — Verify OTP DTO
// ============================================================

import { z } from 'zod';

const DeviceInfoSchema = z.object({
  fingerprint: z.string().min(1, 'Device fingerprint is required'),
  platform: z.enum(['ANDROID', 'IOS']),
  model: z.string().max(100).optional(),
  osVersion: z.string().max(50).optional(),
  appVersion: z.string().max(50).optional(),
  pushToken: z.string().max(500).optional(),
});

export const VerifyOtpDtoSchema = z.object({
  phone: z
    .string()
    .min(1, 'Phone is required')
    .refine(
      (v) => /^\+251[0-9]{9}$/.test(v),
      'Phone must be a valid Ethiopian number (+251 format)',
    ),
  code: z
    .string()
    .length(6, 'OTP must be 6 digits')
    .regex(/^\d{6}$/, 'OTP must be 6 digits'),
  purpose: z.enum(['LOGIN', 'DEVICE_BIND', 'PHONE_CHANGE']).default('LOGIN'),
  device: DeviceInfoSchema,
});

export type VerifyOtpDto = z.infer<typeof VerifyOtpDtoSchema>;
