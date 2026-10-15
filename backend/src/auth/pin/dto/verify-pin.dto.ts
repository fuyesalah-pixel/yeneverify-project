// ============================================================
// Yene Verify — Verify PIN DTO
// ============================================================

import { z } from 'zod';

export const VerifyPinDtoSchema = z.object({
  pin: z
    .string()
    .length(4, 'PIN must be exactly 4 digits') // Note: actual PIN length is 4 or 6
    .regex(/^\d+$/, 'PIN must contain only digits')
    .transform((v) => v), // placeholder; actual length validated in service
});

export type VerifyPinDto = z.infer<typeof VerifyPinDtoSchema>;
