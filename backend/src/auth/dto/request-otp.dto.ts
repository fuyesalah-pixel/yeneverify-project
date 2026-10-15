// ============================================================
// Yene Verify — Request OTP DTO
// ============================================================

import { z } from 'zod';

/**
 * Normalize phone to E.164 +251XXXXXXXXX.
 * Accepts various user input formats and normalizes them.
 */
function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  // Already E.164
  if (value.startsWith('+251') && value.length === 13) return value;
  // Local format starting with 09
  if (digits.startsWith('09') && digits.length === 10) return `+251${digits.slice(1)}`;
  // 9 digits without leading 0
  if (digits.startsWith('9') && digits.length === 9) return `+251${digits}`;
  // 10 digits starting with 251
  if (digits.startsWith('251') && digits.length === 12) return `+${digits}`;
  // Fallback: prepend +251 if it looks like a local number
  if (digits.length === 9 && digits.startsWith('9')) return `+251${digits}`;
  // Return original for validation to catch it
  return value;
}

export const RequestOtpDtoSchema = z.object({
  phone: z
    .string()
    .min(1, 'Phone is required')
    .transform(normalizePhone)
    .refine(
      (v) => /^\+251[0-9]{9}$/.test(v),
      'Phone must be a valid Ethiopian number (+251 format)',
    ),
  purpose: z.enum(['LOGIN', 'DEVICE_BIND', 'PHONE_CHANGE']).default('LOGIN'),
});

export type RequestOtpDto = z.infer<typeof RequestOtpDtoSchema>;
