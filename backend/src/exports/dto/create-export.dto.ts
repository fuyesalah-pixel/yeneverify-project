// ============================================================
// Yene Verify — Create Export DTO (Step 19)
//
// POST /exports body. Zod schema enforces the contract shape;
// cross-field range rules (span ≤ 366 days) are refined here so
// the controller rejects with 422 VALIDATION_FAILED before the
// service ever touches the DB.
//
// Filters map 1:1 onto transactions columns: status, subMerchantId,
// bankCode. from/to are inclusive ISO datetimes (paid_at bounds).
// ============================================================

import { z } from 'zod';

const DAY_MS = 86_400_000;
/** Inclusive span cap for an export request. */
export const MAX_EXPORT_RANGE_DAYS = 366;

export const TransactionStatusFilterSchema = z
  .enum(['VERIFIED', 'FAKE', 'DUPLICATE', 'NEEDS_REVIEW', 'ERROR'])
  .optional();

export const BankCodeFilterSchema = z
  .enum(['CBE', 'TELEBIRR', 'AWASH', 'DASHEN', 'ABYSSINIA', 'MPESA', 'ZEMEN'])
  .optional();

export const CreateExportDtoSchema = z
  .object({
    format: z.enum(['CSV', 'PDF']),
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional(),
    status: TransactionStatusFilterSchema,
    subMerchantId: z.string().uuid().optional(),
    bankCode: BankCodeFilterSchema,
  })
  .strict()
  .refine(
    (body) => {
      const from = body.from ? new Date(body.from) : undefined;
      const to = body.to ? new Date(body.to) : undefined;
      if (!from || !to) return true; // one-sided/absent → service defaults
      return to.getTime() - from.getTime() <= MAX_EXPORT_RANGE_DAYS * DAY_MS;
    },
    { message: `Export range cannot exceed ${MAX_EXPORT_RANGE_DAYS} days` },
  );

export type CreateExportDto = z.infer<typeof CreateExportDtoSchema>;
