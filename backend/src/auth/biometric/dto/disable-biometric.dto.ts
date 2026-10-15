// ============================================================
// Yene Verify — Disable Biometric DTO
// ============================================================

import { z } from 'zod';

export const DisableBiometricDtoSchema = z.object({
  deviceId: z.string().uuid('Device ID must be a valid UUID'),
});

export type DisableBiometricDto = z.infer<typeof DisableBiometricDtoSchema>;
