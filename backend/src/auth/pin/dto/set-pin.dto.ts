// ============================================================
// Yene Verify — Set PIN DTO
// ============================================================

import { z } from 'zod';

export const SetPinDtoSchema = z.object({
  pin: z
    .string()
    .min(4, 'PIN must be at least 4 digits')
    .max(6, 'PIN must be at most 6 digits')
    .regex(/^\d+$/, 'PIN must contain only digits'),
  // Optional: if the access token is older than 5 min, client can include OTP
  otpCode: z
    .string()
    .regex(/^\d{6}$/, 'OTP must be 6 digits')
    .optional(),
});

export type SetPinDto = z.infer<typeof SetPinDtoSchema>;
