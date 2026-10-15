// ============================================================
// Yene Verify — Logout DTO
// ============================================================

import { z } from 'zod';

export const LogoutDtoSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export type LogoutDto = z.infer<typeof LogoutDtoSchema>;
