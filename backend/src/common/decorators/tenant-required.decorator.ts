// ============================================================
// Yene Verify — @TenantRequired() Decorator
// Ensures the current user has a valid merchant tenant scope.
// ============================================================

import { SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const TENANT_REQUIRED_KEY = 'tenantRequired';

/**
 * Marks a route as requiring a valid merchant tenant scope.
 *
 * - MERCHANT: must have an associated Merchant row
 * - SUB_MERCHANT: must have active SubMerchant profile
 * - ADMIN: bypasses (admin has no merchant scope)
 *
 * Use on routes that require a valid merchant context.
 */
export const TenantRequired = () => {
  return SetMetadata(TENANT_REQUIRED_KEY, true);
};

/** Checks if a route requires a tenant scope. */
export function isTenantRequiredRoute(reflector: Reflector, ctx: any): boolean {
  return (
    reflector.getAllAndOverride<boolean>(TENANT_REQUIRED_KEY, [ctx.getHandler(), ctx.getClass()]) ??
    false
  );
}
