// ============================================================
// Yene Verify — Change PIN DTO
// ============================================================

import { z } from 'zod';

export const ChangePinDtoSchema = z.object({
  currentPin: z
    .string()
    .min(4, 'PIN must be at least 4 digits')
    .max(6, 'PIN must be at most 6 digits')
    .regex(/^\d+$/, 'PIN must contain only digits'),
  newPin: z
    .string()
    .min(4, 'PIN must be at least 4 digits')
    .max(6, 'PIN must be at most 6 digits')
    .regex(/^\d+$/, 'PIN must contain only digits'),
});

export type ChangePinDto = z.infer<typeof ChangePinDtoSchema>;
