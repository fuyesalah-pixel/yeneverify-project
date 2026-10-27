// ============================================================
// Yene Verify — CurrentTenant Decorator
// Extracts the tenant scope resolved by the global TenantGuard
// (merchantId from the DB, never from the JWT claims — tokens
// issued by the login flow carry no merchantId, and a claim
// would be a spoofable, possibly stale source).
// ============================================================

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { TenantIsolationError } from '../errors/domain-errors';

/** Tenant scope attached to the request by the global TenantGuard. */
export interface TenantScope {
  merchantId: string;
  subMerchantId?: string;
}

/**
 * Injects the TenantGuard-resolved tenant for the request.
 * @example
 *   @Get()
 *   list(@CurrentTenant() tenant: TenantScope) { ... }
 */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TenantScope | undefined => {
    const req = ctx.switchToHttp().getRequest<Request & { tenant?: TenantScope }>();
    return req.tenant;
  },
);

/**
 * Use in controllers to insist the route runs with a real merchant
 * scope. TenantGuard normally guarantees this for MERCHANT/SUB_MERCHANT
 * routes (it throws MerchantNotOnboardedError earlier); this is the
 * defensive line for anything that reaches a handler without one.
 */
export function requireTenant(tenant: TenantScope | undefined): string {
  if (!tenant?.merchantId) {
    throw new TenantIsolationError();
  }
  return tenant.merchantId;
}
