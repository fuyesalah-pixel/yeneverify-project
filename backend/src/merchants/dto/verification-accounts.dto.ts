// ============================================================
// Yene Verify — Merchant Verification Accounts DTOs
//
// Stored on Merchant.verificationAccounts as JSONB. The merchant enters
// their full account number; the backend derives the suffix each bank
// adapter needs (`last8`, `last5`, or the full `accountNumber` for Awash).
// Every field is optional; the update payload is merged into the stored
// object so a settings screen can save one bank without wiping the others.
// Sending `null` for a bank clears it.
// ============================================================

import { z } from 'zod';

export const FULL_ACCOUNT_PATTERN = /^\d{10,16}$/;
export const FULL_ACCOUNT_MESSAGE = 'Must be 10 to 16 digits';

export const FullAccountNumberSchema = z.string().regex(FULL_ACCOUNT_PATTERN, FULL_ACCOUNT_MESSAGE);

const Last8Schema = z.string().regex(/^\d{8}$/, 'Must be exactly 8 digits');
const Last5Schema = z.string().regex(/^\d{5}$/, 'Must be exactly 5 digits');

// Stored/response shapes. The legacy union members keep last-N-only rows
// written before this change readable for verification; they are replaced
// as soon as the merchant saves the account again.
const StoredCbeSchema = z.union([
  z.object({ full: FullAccountNumberSchema, last8: Last8Schema }).strict(),
  z.object({ last8: Last8Schema }).strict(),
]);
const StoredAbyssiniaSchema = z.union([
  z.object({ full: FullAccountNumberSchema, last5: Last5Schema }).strict(),
  z.object({ last5: Last5Schema }).strict(),
]);
const StoredAwashSchema = z.union([
  z.object({ full: FullAccountNumberSchema, accountNumber: FullAccountNumberSchema }).strict(),
  z.object({ accountNumber: FullAccountNumberSchema }).strict(),
]);

export const VerificationAccountsSchema = z
  .object({
    cbe: StoredCbeSchema.optional(),
    abyssinia: StoredAbyssiniaSchema.optional(),
    awash: StoredAwashSchema.optional(),
  })
  .strict();

export const VerificationAccountsUpdateSchema = z
  .object({
    cbe: z.object({ full: FullAccountNumberSchema }).strict().nullable().optional(),
    abyssinia: z.object({ full: FullAccountNumberSchema }).strict().nullable().optional(),
    awash: z.object({ full: FullAccountNumberSchema }).strict().nullable().optional(),
  })
  .strict();

export type VerificationAccounts = z.infer<typeof VerificationAccountsSchema>;
export type VerificationAccountsUpdate = z.infer<typeof VerificationAccountsUpdateSchema>;

export const VerificationAccountsResponseSchema = z.object({
  verificationAccounts: VerificationAccountsSchema,
});

export type VerificationAccountsResponse = z.infer<typeof VerificationAccountsResponseSchema>;
