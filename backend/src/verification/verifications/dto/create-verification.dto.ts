// ============================================================
// Yene Verify — Create Verification DTO (13E.3)
// ============================================================

import { z } from 'zod';
import { QR_CONTENT_TYPES } from '../../qr/qr-hints';

export const BANK_CODES = [
  'CBE',
  'TELEBIRR',
  'AWASH',
  'DASHEN',
  'ABYSSINIA',
  'MPESA',
  'ZEMEN',
] as const;
export type BankCodeLiteral = (typeof BANK_CODES)[number];

export const BILLING_PACKAGE_CODES = ['PREMIUM', 'BUSINESS', 'BUSINESS_PRO'] as const;

export const CreateVerificationDtoSchema = z
  .object({
    receiptId: z.string().uuid('receiptId must be a valid UUID'),
    source: z.enum(['TRANSACTION', 'BILLING']).default('TRANSACTION'),
    // Required only when source = BILLING (validated below).
    billingPackageCode: z.enum(BILLING_PACKAGE_CODES).optional(),
    // bigint as a decimal string — JSON cannot carry bigint safely.
    billingExpectedAmountMinor: z
      .string()
      .regex(/^\d+$/, 'billingExpectedAmountMinor must be decimal digits')
      .refine((v) => v !== '0', 'billingExpectedAmountMinor must be at least 1')
      .optional(),
    // Reserved: soft hints for a future manual-entry submission path.
    hintBankCode: z.enum(BANK_CODES).optional(),
    hintReference: z.string().min(1).max(40).optional(),
    // Scanned QR payload (v1.8.4). A HINT only: the adapter still
    // decides the verdict; the pipeline may use it to skip OCR.
    qrContent: z.string().trim().min(1).max(2048).optional(),
    qrType: z.enum(QR_CONTENT_TYPES).optional(),
  })
  .superRefine((dto, ctx) => {
    if ((dto.qrContent === undefined) !== (dto.qrType === undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [dto.qrContent === undefined ? 'qrContent' : 'qrType'],
        message: 'qrContent and qrType must be provided together',
      });
    }
    if (dto.source === 'BILLING') {
      if (!dto.billingPackageCode) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['billingPackageCode'],
          message: 'billingPackageCode is required when source is BILLING',
        });
      }
      if (!dto.billingExpectedAmountMinor) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['billingExpectedAmountMinor'],
          message: 'billingExpectedAmountMinor is required when source is BILLING',
        });
      }
    }
  });

export type CreateVerificationDto = z.infer<typeof CreateVerificationDtoSchema>;
