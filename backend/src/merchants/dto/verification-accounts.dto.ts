// ============================================================
// Yene Verify — Merchant Verification Accounts DTOs
//
// Stored on Merchant.verificationAccounts as JSONB. Every field is
// optional; the update payload is merged into the stored object so a
// settings screen can save one bank without wiping the others.
// Sending `null` for a field (or a whole bank) clears it.
// ============================================================

import { z } from 'zod';

export const VerificationAccountsSchema = z
  .object({
    cbe: z
      .object({
        last8: z.string().regex(/^\d{8}$/, 'Must be exactly 8 digits'),
      })
      .strict()
      .optional(),
    abyssinia: z
      .object({
        last5: z.string().regex(/^\d{5}$/, 'Must be exactly 5 digits'),
      })
      .strict()
      .optional(),
    awash: z
      .object({
        accountNumber: z.string().regex(/^\d{10,16}$/, 'Must be 10 to 16 digits'),
      })
      .strict()
      .optional(),
  })
  .strict();

export const VerificationAccountsUpdateSchema = z
  .object({
    cbe: z
      .object({
        last8: z
          .string()
          .regex(/^\d{8}$/, 'Must be exactly 8 digits')
          .nullable()
          .optional(),
      })
      .strict()
      .nullable()
      .optional(),
    abyssinia: z
      .object({
        last5: z
          .string()
          .regex(/^\d{5}$/, 'Must be exactly 5 digits')
          .nullable()
          .optional(),
      })
      .strict()
      .nullable()
      .optional(),
    awash: z
      .object({
        accountNumber: z
          .string()
          .regex(/^\d{10,16}$/, 'Must be 10 to 16 digits')
          .nullable()
          .optional(),
      })
      .strict()
      .nullable()
      .optional(),
  })
  .strict();

export type VerificationAccounts = z.infer<typeof VerificationAccountsSchema>;
export type VerificationAccountsUpdate = z.infer<typeof VerificationAccountsUpdateSchema>;

export const VerificationAccountsResponseSchema = z.object({
  verificationAccounts: VerificationAccountsSchema,
});

export type VerificationAccountsResponse = z.infer<typeof VerificationAccountsResponseSchema>;
