// ============================================================
// Yene Verify — Sub-Merchant Scope Helper
// Helper to add sub-merchant scoping to queries.
// ============================================================

/**
 * Apply sub-merchant scoping to a where clause.
 *
 * For SUB_MERCHANT role, restricts results to only their own records
 * by adding the appropriate user ID filter.
 *
 * @param where - The Prisma where clause to modify
 * @param ctx - The request context (from requestContext.mustGet())
 * @param userIdField - The field name for the user ID (default: 'verifiedByUserId')
 *
 * @example
 * ```ts
 * const where = applySubMerchantScope({ merchantId: ctx.tenant!.merchantId }, ctx);
 * // For SUB_MERCHANT: adds verifiedByUserId: ctx.user.id
 * ```
 */
export function applySubMerchantScope<T extends Record<string, any>>(
  where: T,
  ctx: { user?: { role: string; id: string } },
  userIdField: string = 'verifiedByUserId',
): T {
  if (!ctx?.user || ctx.user.role !== 'SUB_MERCHANT') {
    return where;
  }

  return {
    ...where,
    [userIdField]: ctx.user.id,
  } as T;
}

/**
 * Apply sub-merchant scoping for receipts (uses uploadedByUserId).
 */
export function applySubMerchantReceiptScope<T extends Record<string, any>>(
  where: T,
  ctx: { user?: { role: string; id: string } },
): T {
  return applySubMerchantScope(where, ctx, 'uploadedByUserId');
}

/**
 * Apply sub-merchant scoping for verifications (uses verifiedByUserId).
 */
export function applySubMerchantVerificationScope<T extends Record<string, any>>(
  where: T,
  ctx: { user?: { role: string; id: string } },
): T {
  return applySubMerchantScope(where, ctx, 'verifiedByUserId');
}

/**
 * Apply sub-merchant scoping for transactions (uses verifiedByUserId).
 */
export function applySubMerchantTransactionScope<T extends Record<string, any>>(
  where: T,
  ctx: { user?: { role: string; id: string } },
): T {
  return applySubMerchantScope(where, ctx, 'verifiedByUserId');
}

/**
 * Apply sub-merchant scoping for notifications (uses userId).
 */
export function applySubMerchantNotificationScope<T extends Record<string, any>>(
  where: T,
  ctx: { user?: { role: string; id: string } },
): T {
  return applySubMerchantScope(where, ctx, 'userId');
}

/**
 * Apply sub-merchant scoping for exports (uses requestedByUserId).
 */
export function applySubMerchantExportScope<T extends Record<string, any>>(
  where: T,
  ctx: { user?: { role: string; id: string } },
): T {
  return applySubMerchantScope(where, ctx, 'requestedByUserId');
}

/**
 * Check if a sub-merchant is allowed to access a specific resource.
 *
 * @param resourceUserId - The userId that owns the resource
 * @param ctx - The request context
 * @returns true if the sub-merchant can access the resource
 */
export function canSubMerchantAccess(
  resourceUserId: string,
  ctx: { user?: { role: string; id: string } } | undefined,
): boolean {
  if (!ctx?.user || ctx.user.role !== 'SUB_MERCHANT') {
    return true; // MERCHANT and ADMIN have full access
  }
  return resourceUserId === ctx.user.id;
}
