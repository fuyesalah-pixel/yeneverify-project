// ============================================================
// Yene Verify — Update Language DTO
// ============================================================

import { z } from 'zod';

export const UpdateLanguageDtoSchema = z.object({
  language: z.enum(['en', 'am']),
});

export type UpdateLanguageDto = z.infer<typeof UpdateLanguageDtoSchema>;
