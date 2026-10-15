// ============================================================
// Yene Verify — Tenant Service
// Convenience service to access the current tenant scope from
// the request context. Use in services instead of raw requestContext.
// ============================================================

import { Injectable } from '@nestjs/common';
import { requestContext } from '../common/context/request-context';
import {
  ForbiddenError,
  MerchantNotOnboardedError,
  SubMerchantNotActiveError,
} from '../common/errors/domain-errors';

/**
 * Current tenant scope from the request context.
 */
export interface TenantScope {
  merchantId: string;
  subMerchantId?: string;
}

/**
 * Service to safely access the current tenant scope.
 * Provides typed accessors and validation helpers.
 */
@Injectable()
export class TenantService {
  /**
   * Get the current tenant scope.
   * Throws if no tenant scope is set (use requireTenant for strict access).
   */
  getTenant(): TenantScope | undefined {
    const ctx = requestContext.get();
    if (!ctx?.tenant) return undefined;
    return {
      merchantId: ctx.tenant.merchantId,
      subMerchantId: ctx.tenant.subMerchantId,
    };
  }

  /**
   * Get the current tenant scope, throwing if not set.
   * Use in service methods that require a tenant scope.
   */
  requireTenant(): TenantScope {
    const tenant = this.getTenant();
    if (!tenant || !tenant.merchantId) {
      throw new ForbiddenError('Tenant scope required but not available');
    }
    return tenant;
  }

  /**
   * Get the current merchant ID, throwing if not available.
   */
  requireMerchantId(): string {
    return this.requireTenant().merchantId;
  }

  /**
   * Get the current sub-merchant ID (only for SUB_MERCHANT role).
   */
  getSubMerchantId(): string | undefined {
    return this.getTenant()?.subMerchantId;
  }

  /**
   * Check if the current request has a tenant scope.
   */
  hasTenant(): boolean {
    return !!this.getTenant()?.merchantId;
  }

  /**
   * Check if the current user is a sub-merchant.
   */
  isSubMerchant(): boolean {
    const ctx = requestContext.get();
    return ctx?.user?.role === 'SUB_MERCHANT';
  }

  /**
   * Check if the current user is a merchant.
   */
  isMerchant(): boolean {
    const ctx = requestContext.get();
    return ctx?.user?.role === 'MERCHANT';
  }

  /**
   * Check if the current user is an admin.
   */
  isAdmin(): boolean {
    const ctx = requestContext.get();
    return ctx?.user?.role === 'ADMIN';
  }

  /**
   * Check if the current request is a system context (background job).
   */
  isSystem(): boolean {
    const ctx = requestContext.get();
    return ctx?.isSystem ?? false;
  }

  /**
   * Throw if the current user is a sub-merchant without a sub-merchant ID.
   * Use in endpoints that require an active sub-merchant profile.
   */
  requireSubMerchant(): { merchantId: string; subMerchantId: string } {
    const tenant = this.getTenant();
    if (!tenant?.merchantId) {
      throw new MerchantNotOnboardedError();
    }
    if (!tenant.subMerchantId) {
      throw new SubMerchantNotActiveError();
    }
    return { merchantId: tenant.merchantId, subMerchantId: tenant.subMerchantId };
  }

  /**
   * Throw if the current user is a merchant without a merchant row.
   * Use in endpoints that require a fully onboarded merchant.
   */
  requireMerchant(): { merchantId: string } {
    const tenant = this.getTenant();
    if (!tenant?.merchantId) {
      throw new MerchantNotOnboardedError();
    }
    return { merchantId: tenant.merchantId };
  }
}
