// ============================================================
// Yene Verify — List Notifications Query DTO (Step 15)
// ============================================================

import { z } from 'zod';
import type { NotificationType } from '@prisma/client';

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

export const NOTIFICATION_TYPES = [
  'VERIFICATION_RESULT',
  'CREDIT_LOW',
  'CREDIT_EXHAUSTED',
  'BILLING_APPROVED',
  'BILLING_REJECTED',
  'SUB_MERCHANT_INVITED',
  'SUB_MERCHANT_JOINED',
  'SUB_MERCHANT_DECLINED',
  'SYSTEM',
] as const;

export const ListNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  unreadOnly: z
    .union([z.literal('true'), z.literal('false')])
    .transform((v) => v === 'true')
    .default('false'),
  type: csvEnum(NOTIFICATION_TYPES).optional(),
});

export type ListNotificationsQuery = z.infer<typeof ListNotificationsQuerySchema> & {
  type?: NotificationType[];
};
