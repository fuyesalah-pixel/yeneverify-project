// ============================================================
// Yene Verify — TenantRequired Guard
// Enforces @TenantRequired() metadata: user must have a valid
// merchant tenant scope (merchant row exists, sub-merchant is active).
// ============================================================

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { AuthUser } from '../types/auth-user.type';
import { TENANT_REQUIRED_KEY } from '../decorators/tenant-required.decorator';
import { MerchantNotOnboardedError, SubMerchantNotActiveError } from '../errors/domain-errors';

@Injectable()
export class TenantRequiredGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const isRequired = this.reflector.getAllAndOverride<boolean>(TENANT_REQUIRED_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    if (!isRequired) return true;

    const req = ctx
      .switchToHttp()
      .getRequest<
        Request & { user?: AuthUser; tenant?: { merchantId: string; subMerchantId?: string } }
      >();
    const user = req.user;
    const tenant = req.tenant;

    if (!user) {
      // Should not happen — JwtAuthGuard runs first
      return false;
    }

    // ADMIN bypasses tenant checks entirely
    if (user.role === 'ADMIN') return true;

    // Must have a tenant scope
    if (!tenant?.merchantId) {
      // Check if it's a MERCHANT without onboarded merchant
      if (user.role === 'MERCHANT') {
        throw new MerchantNotOnboardedError();
      }
      // SUB_MERCHANT without tenant means inactive or no profile
      if (user.role === 'SUB_MERCHANT') {
        throw new SubMerchantNotActiveError();
      }
      return false;
    }

    // For SUB_MERCHANT, ensure they have an active sub-merchant profile
    if (user.role === 'SUB_MERCHANT' && !req.tenant?.subMerchantId) {
      throw new SubMerchantNotActiveError();
    }

    return true;
  }
}
