// ============================================================
// Yene Verify — Enable Biometric DTO
// ============================================================

import { z } from 'zod';

export const EnableBiometricDtoSchema = z.object({
  deviceId: z.string().uuid('Device ID must be a valid UUID'),
});

export type EnableBiometricDto = z.infer<typeof EnableBiometricDtoSchema>;
