// ============================================================
// Yene Verify — Complete Upload DTO
// ============================================================

import { z } from 'zod';

export const CompleteUploadDtoSchema = z.object({
  storageKey: z
    .string()
    .min(1, 'storageKey is required')
    .max(512, 'storageKey must be at most 512 characters')
    .refine((v) => !v.includes('..'), 'storageKey must not contain ".."')
    .refine((v) => !v.includes('\\'), 'storageKey must not contain backslashes'),
  inputMethod: z.enum(['PHOTO', 'UPLOAD']).default('UPLOAD'),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i, 'sha256 must be 64 hexadecimal characters'),
  width: z.number().int().positive().max(20_000).optional(),
  height: z.number().int().positive().max(20_000).optional(),
});

export type CompleteUploadDto = z.infer<typeof CompleteUploadDtoSchema>;
