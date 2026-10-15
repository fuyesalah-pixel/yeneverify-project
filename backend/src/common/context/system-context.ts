// ============================================================
// Yene Verify — System Context Helpers
// Helpers for background jobs and admin operations to run with
// specific tenant contexts (system or merchant).
// ============================================================

import { PrismaService } from '../../prisma/prisma.service';
import { requestContext, createRequestContext } from './request-context';

/**
 * Run a callback as the system context (bypasses RLS).
 *
 * Use for:
 * - Background jobs (purge, prune, reconciliation)
 * - Admin cross-tenant operations (fraud review, platform analytics)
 * - System-level maintenance
 *
 * @param reason - Human-readable reason for audit logging (required)
 * @param fn - Async callback to run with system context
 *
 * @example
 * ```ts
 * await runAsSystem('fraud.review.read', async () => {
 *   return prisma.transaction.findMany({ where: { ... } });
 * });
 * ```
 */
export async function runAsSystem<T>(
  prisma: PrismaService,
  reason: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (!reason) {
    throw new Error('runAsSystem requires a reason string for audit purposes');
  }

  const ctx = createRequestContext(`system:${reason}`);
  ctx.isSystem = true;

  return prisma.$transaction(async (tx) => {
    // Set system context — no merchant, role = ADMIN (bypasses RLS)
    await tx.$executeRawUnsafe(
      `SELECT set_config('app.current_user_id', $1, true),
              set_config('app.current_role', $2, true),
              set_config('app.current_merchant_id', $3, true)`,
      'system',
      'ADMIN',
      '',
    );

    return requestContext.run({ ...createRequestContext(`system:${reason}`), isSystem: true }, fn);
  });
}

/**
 * Run a callback with a specific merchant context.
 *
 * Use for:
 * - Merchant-scoped background jobs (verification processing, exports)
 * - Scheduled jobs that need to act on behalf of a specific merchant
 *
 * @param merchantId - The merchant UUID to scope to
 * @param fn - Async callback to run with merchant context
 *
 * @example
 * ```ts
 * await runAsMerchant(prisma, merchantId, async () => {
 *   return prisma.verification.findMany({ where: { status: 'PENDING' } });
 * });
 * ```
 */
export async function runAsMerchant<T>(
  prisma: PrismaService,
  merchantId: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (!merchantId) {
    throw new Error('runAsMerchant requires a merchantId');
  }

  // Use a system user ID for the job
  const systemUserId = `job:${merchantId}`;

  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SELECT set_config('app.current_user_id', $1, true),
              set_config('app.current_role', $2, true),
              set_config('app.current_merchant_id', $3, true)`,
      systemUserId,
      'MERCHANT' as const,
      merchantId,
    );

    return fn();
  });
}

/**
 * Run a callback with a specific sub-merchant context.
 *
 * Use for:
 * - Jobs that need to act on behalf of a specific sub-merchant
 *
 * @param merchantId - The parent merchant UUID
 * @param subMerchantId - The sub-merchant UUID
 * @param fn - Async callback
 */
export async function runAsSubMerchant<T>(
  prisma: PrismaService,
  merchantId: string,
  subMerchantId: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (!merchantId || !subMerchantId) {
    throw new Error('runAsSubMerchant requires both merchantId and subMerchantId');
  }

  const systemUserId = `job:${subMerchantId}`;

  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SELECT set_config('app.current_user_id', $1, true),
              set_config('app.current_role', $2, true),
              set_config('app.current_merchant_id', $3, true)`,
      systemUserId,
      'SUB_MERCHANT' as const,
      merchantId,
    );

    return fn();
  });
}

/**
 * Run a callback with a specific admin user context.
 *
 * Use for:
 * - Admin-initiated background operations
 * - Audit trail shows the admin who initiated
 *
 * @param adminUserId - The admin user ID
 * @param reason - Audit reason
 * @param fn - Async callback
 */
export async function runAsAdmin<T>(
  prisma: PrismaService,
  adminUserId: string,
  reason: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (!adminUserId || !reason) {
    throw new Error('runAsAdmin requires adminUserId and reason');
  }

  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SELECT set_config('app.current_user_id', $1, true),
              set_config('app.current_role', $2, true),
              set_config('app.current_merchant_id', $3, true)`,
      adminUserId,
      'ADMIN' as const,
      '',
    );

    return fn();
  });
}

/**
 * Type for job context options.
 */
export interface JobContextOptions {
  /** Merchant ID for merchant-scoped jobs */
  merchantId?: string;
  /** Sub-merchant ID for sub-merchant-scoped jobs */
  subMerchantId?: string;
  /** Admin user ID for admin-scoped jobs */
  adminUserId?: string;
  /** Reason for audit log (required for system/admin contexts) */
  reason?: string;
}

/**
 * Factory function to run a job with the appropriate context.
 *
 * @param prisma - PrismaService instance
 * @param options - Context options (exactly one of merchantId, subMerchantId, adminUserId, or none for system)
 * @param fn - Callback to run
 *
 * @example
 * ```ts
 * // System job
 * await runJob(prisma, { reason: 'purge.otp' }, async () => { ... });
 *
 * // Merchant job
 * await runJob(prisma, { merchantId: '...' }, async () => { ... });
 *
 * // Admin job
 * await runJob(prisma, { adminUserId: '...', reason: 'fraud.review' }, async () => { ... });
 * ```
 */
export async function runJob<T>(
  prisma: PrismaService,
  options: JobContextOptions,
  fn: () => Promise<T>,
): Promise<T> {
  const { merchantId, subMerchantId, adminUserId, reason } = options;

  // Exactly one context must be provided
  const contexts = [
    merchantId,
    subMerchantId,
    adminUserId,
    !merchantId && !subMerchantId && !adminUserId,
  ].filter(Boolean);
  if (contexts.length !== 1) {
    throw new Error(
      'runJob requires exactly one context: merchantId, subMerchantId, adminUserId, or none (system)',
    );
  }

  if (adminUserId) {
    if (!reason) throw new Error('admin context requires a reason');
    return runAsAdmin(prisma, adminUserId, reason, fn);
  }

  if (subMerchantId) {
    if (!merchantId) throw new Error('subMerchantId requires merchantId');
    return runAsSubMerchant(prisma, merchantId, subMerchantId, fn);
  }

  if (merchantId) {
    return runAsMerchant(prisma, merchantId, fn);
  }

  // System context
  if (!reason) throw new Error('system context requires a reason');
  return runAsSystem(prisma, reason, fn);
}
