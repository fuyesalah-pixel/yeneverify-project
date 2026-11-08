// ============================================================
// Yene Verify â€” Google Auth DTOs
// POST /api/v1/auth/google, /auth/google/link, /auth/google/unlink
// ============================================================

import { z } from 'zod';

export const GoogleIdTokenDtoSchema = z.object({
  idToken: z.string().min(1, 'idToken is required'),
});

export type GoogleIdTokenDto = z.infer<typeof GoogleIdTokenDtoSchema>;

export const GoogleLoginResponseSchema = z.object({
  ok: z.boolean(),
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
});

export type GoogleLoginResponse = z.infer<typeof GoogleLoginResponseSchema>;
