// ============================================================
// Yene Verify — Device Response DTO
// ============================================================

import { z } from 'zod';

export const DeviceResponseDtoSchema = z.object({
  id: z.string().uuid(),
  fingerprint: z.string(),
  platform: z.enum(['ANDROID', 'IOS']),
  model: z.string().nullable().optional(),
  osVersion: z.string().nullable().optional(),
  appVersion: z.string().nullable().optional(),
  pushToken: z.string().nullable().optional(),
  lastSeenAt: z.string().datetime().nullable().optional(),
  revokedAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
});

export type DeviceResponseDto = z.infer<typeof DeviceResponseDtoSchema>;
