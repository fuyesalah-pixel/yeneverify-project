// ============================================================
// Yene Verify — Tenant Guard
// Resolves tenant scope from the authenticated user and
// attaches it to the request for downstream use.
// Runs after JwtAuthGuard (req.user is set).
// ============================================================

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { AuthUser } from '../types/auth-user.type';
import { TenantResolverService } from '../../tenant/tenant.resolver.service';
import { MerchantNotOnboardedError, SubMerchantNotActiveError } from '../errors/domain-errors';
import { SKIP_TENANT_KEY } from '../decorators/skip-tenant.decorator';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenantResolver: TenantResolverService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    // Skip if route is public
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    // Routes that must run before tenant scope exists (onboarding itself)
    const skipTenant = this.reflector.getAllAndOverride<boolean>(SKIP_TENANT_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (skipTenant) return true;

    const req = ctx.switchToHttp().getRequest<
      Request & {
        user?: AuthUser;
        tenant?: { merchantId: string; subMerchantId?: string };
      }
    >();

    const user = req.user;

    if (!user) {
      // Should not happen — JwtAuthGuard runs first
      return false;
    }

    // ADMIN has no tenant scope; RLS bypassed via isSystem on admin routes
    if (user.role === 'ADMIN') {
      req.tenant = { merchantId: '' };
      return true;
    }

    // Resolve tenant scope (cached in Redis)
    try {
      const tenant = await this.tenantResolver.resolve(user);
      req.tenant = tenant;
    } catch (e) {
      // Re-throw domain errors for proper error responses
      if (e instanceof MerchantNotOnboardedError || e instanceof SubMerchantNotActiveError) {
        throw e;
      }
      throw e;
    }

    return true;
  }
}
