// ============================================================
// Yene Verify — Tenant Resolver Service
// Resolves merchant/sub-merchant tenant scope from the
// authenticated user. Caches in Redis for 60s.
// ============================================================

import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';
import type { UserRole } from '@prisma/client';
import {
  MerchantNotOnboardedError,
  SubMerchantNotActiveError,
} from '../common/errors/domain-errors';

/**
 * Resolved tenant scope for the current request.
 */
export interface ResolvedTenant {
  /** Merchant UUID — always present for MERCHANT/SUB_MERCHANT */
  merchantId: string;
  /** SubMerchant UUID — only for SUB_MERCHANT role */
  subMerchantId?: string;
}

/**
 * Cache key prefix for tenant resolution.
 */
const TENANT_CACHE_PREFIX = 'tenant:user:';
const TENANT_CACHE_TTL_SECONDS = 60; // 60s TTL

@Injectable()
export class TenantResolverService {
  private readonly logger = new Logger(TenantResolverService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  /**
   * Resolve the tenant scope for the authenticated user.
   *
   * Logic:
   * - ADMIN: no tenant scope (bypasses RLS via isSystem for admin routes)
   * - MERCHANT: load Merchant by owner_user_id; if missing → needs onboarding
   * - SUB_MERCHANT: load SubMerchant by user_id; must be ACTIVE
   *
   * Caches result in Redis for 60s. Invalidated on merchant/sub-merchant mutations.
   *
   * @throws MerchantNotOnboardedError if MERCHANT has no merchant row
   * @throws SubMerchantNotActiveError if SUB_MERCHANT is not ACTIVE
   */
  async resolve(user: { id: string; role: UserRole }): Promise<ResolvedTenant> {
    const cacheKey = `${TENANT_CACHE_PREFIX}${user.id}`;

    // Try cache first
    const cached = await this.cache.get<ResolvedTenant>(cacheKey);
    if (cached) return cached;

    let resolved: ResolvedTenant;

    switch (user.role) {
      case 'ADMIN':
        // Admin has no tenant scope — RLS bypassed via isSystem on admin routes
        resolved = { merchantId: '' };
        break;

      case 'MERCHANT': {
        const merchant = await this.prisma.merchant.findUnique({
          where: { ownerUserId: user.id },
          select: { id: true },
        });

        if (!merchant) {
          throw new MerchantNotOnboardedError();
        }

        resolved = { merchantId: merchant.id };
        break;
      }

      case 'SUB_MERCHANT': {
        const subMerchant = await this.prisma.subMerchant.findUnique({
          where: { userId: user.id },
          select: { id: true, merchantId: true, status: true },
        });

        if (!subMerchant) {
          throw new SubMerchantNotActiveError();
        }

        if (subMerchant.status !== 'ACTIVE') {
          throw new SubMerchantNotActiveError();
        }

        resolved = {
          merchantId: subMerchant.merchantId,
          subMerchantId: subMerchant.id,
        };
        break;
      }

      default:
        throw new Error(`Unknown role: ${user.role}`);
    }

    // Cache the result
    await this.cache.set(cacheKey, resolved, TENANT_CACHE_TTL_SECONDS * 1000);
    return resolved;
  }

  /**
   * Invalidate the tenant cache for a user.
   * Call this when merchant or sub-merchant data changes.
   */
  async invalidate(userId: string): Promise<void> {
    const cacheKey = `${TENANT_CACHE_PREFIX}${userId}`;
    await this.cache.del(cacheKey);
  }

  /**
   * Invalidate all tenant caches for a merchant (e.g., when merchant is updated).
   */
  async invalidateMerchant(merchantId: string): Promise<void> {
    // In a production system, you'd use Redis SCAN to find all keys
    // For now, we rely on TTL expiration
    this.logger.debug(`Merchant ${merchantId} updated — tenant caches will expire in TTL`);
  }
}
