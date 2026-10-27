// ============================================================
// Yene Verify — List Verifications Query DTO (13E.3)
// ============================================================

import { z } from 'zod';
import { BANK_CODES } from './create-verification.dto';

const csvEnum = (values: readonly string[]) =>
  z
    .string()
    .transform((raw) =>
      raw
        .split(',')
        .map((v) => v.trim().toUpperCase())
        .filter((v) => v.length > 0),
    )
    .refine(
      (list) => list.every((v) => (values as readonly string[]).includes(v)),
      `Allowed values (comma-separated): ${values.join(', ')}`,
    );

export const ListVerificationsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(100).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    status: csvEnum([
      'PENDING',
      'VERIFIED',
      'FAKE',
      'DUPLICATE',
      'NEEDS_REVIEW',
      'ERROR',
    ]).optional(),
    source: z.enum(['TRANSACTION', 'BILLING']).optional(),
    bankCode: csvEnum(BANK_CODES).optional(),
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional(),
    // MERCHANT-only: filter to one sub-merchant's verifications
    // (verifiedByUserId is the sub-merchant's user id).
    subMerchantId: z.string().uuid().optional(),
    search: z
      .string()
      .min(1)
      .max(100)
      // Never let SQL wildcards through an unanchored search.
      .refine((v) => !v.includes('%') && !v.includes('_'), {
        message: 'search must not contain % or _ wildcards',
      })
      .optional(),
    sortBy: z.enum(['createdAt', 'amountMinor']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
  .superRefine((q, ctx) => {
    if (q.from && q.to && q.from > q.to) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['from'],
        message: 'from must be earlier than or equal to to',
      });
    }
  });

export type ListVerificationsQuery = z.infer<typeof ListVerificationsQuerySchema>;
