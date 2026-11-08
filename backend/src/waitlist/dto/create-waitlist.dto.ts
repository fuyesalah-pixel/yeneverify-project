// ============================================================
// Yene Verify â€” Waitlist DTO
// POST /api/v1/waitlist body validation.
// ============================================================

import { z } from 'zod';

export const CreateWaitlistDtoSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  source: z.string().optional(),
});

export type CreateWaitlistDto = z.infer<typeof CreateWaitlistDtoSchema>;
