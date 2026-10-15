// ============================================================
// Yene Verify — Refresh Token DTO
// ============================================================

import { z } from 'zod';

export const RefreshTokenDtoSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export type RefreshTokenDto = z.infer<typeof RefreshTokenDtoSchema>;
