// ============================================================
// Yene Verify — Presign Upload DTO
// ============================================================

import { z } from 'zod';
import {
  ALLOWED_RECEIPT_MIME_TYPES,
  MAX_RECEIPT_BYTES,
} from '../../storage/drivers/storage-driver.interface';

export const PresignUploadDtoSchema = z.object({
  fileName: z
    .string()
    .min(1, 'File name is required')
    .max(128, 'File name must be at most 128 characters')
    .refine(
      (v) => !v.includes('/') && !v.includes('\\'),
      'File name must not contain path separators',
    ),
  mimeType: z.enum(ALLOWED_RECEIPT_MIME_TYPES, {
    errorMap: () => ({ message: 'mimeType must be image/jpeg, image/png, or image/webp' }),
  }),
  sizeBytes: z
    .number()
    .int('sizeBytes must be an integer')
    .min(1, 'sizeBytes must be greater than 0')
    .max(MAX_RECEIPT_BYTES, `sizeBytes must be at most ${MAX_RECEIPT_BYTES}`),
  inputMethod: z.enum(['PHOTO', 'UPLOAD']).default('UPLOAD'),
});

export type PresignUploadDto = z.infer<typeof PresignUploadDtoSchema>;
