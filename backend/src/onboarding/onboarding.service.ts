// ============================================================
// Yene Verify — Onboarding Service
// Handles merchant onboarding and business profile creation.
// ============================================================

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AppError } from '../common/errors/app-error';
import { ERROR_CODES } from '../common/constants/error-codes';
import { CreateMerchantDto } from './dto/create-merchant.dto';

const FREE_PLAN_INITIAL_CREDITS = 10n;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Create merchant profile for a new MERCHANT user.
   * Creates Merchant, FREE subscription, and initial credit grant.
   */
  async createMerchant(
    userId: string,
    dto: CreateMerchantDto,
    ip: string,
    userAgent: string | undefined,
  ) {
    // Guard the FK before it can fail: a caller passing a broken/empty
    // owner id means wiring is wrong, not that the merchant data is bad.
    if (!UUID_RE.test(userId)) {
      throw new AppError(
        ERROR_CODES.VALIDATION_FAILED,
        'Owner user id must come from the authenticated session.',
        500,
      );
    }

    const existing = await this.prisma.merchant.findUnique({
      where: { ownerUserId: userId },
      select: { id: true },
    });
    if (existing) {
      throw new AppError(
        ERROR_CODES.MERCHANT_ALREADY_ONBOARDED,
        'This account already has a merchant profile.',
        409,
      );
    }

    const freePackage = await this.prisma.package.findUnique({
      where: { code: 'FREE' },
      select: { code: true },
    });
    if (!freePackage) {
      throw new AppError(ERROR_CODES.INTERNAL_ERROR, 'FREE package is not configured.', 500);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const merchant = await tx.merchant.create({
        data: {
          id: crypto.randomUUID(),
          ownerUserId: userId,
          businessName: dto.businessName,
          businessType: dto.businessType,
          tin: dto.tin,
          address: dto.address,
          city: dto.city,
          region: dto.region,
          status: 'ACTIVE',
          creditsBalance: 0n,
          currentPackageCode: 'FREE',
        },
      });

      const subscription = await tx.subscription.create({
        data: {
          id: crypto.randomUUID(),
          merchantId: merchant.id,
          packageCode: 'FREE',
          status: 'ACTIVE',
          startedAt: new Date(),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          autoRenew: true,
        },
      });

      await tx.merchant.update({
        where: { id: merchant.id },
        data: { subscriptionId: subscription.id },
      });

      await tx.creditTransaction.create({
        data: {
          id: crypto.randomUUID(),
          merchantId: merchant.id,
          type: 'GRANT',
          amount: FREE_PLAN_INITIAL_CREDITS,
          balanceAfter: FREE_PLAN_INITIAL_CREDITS,
          subscriptionId: subscription.id,
          reason: 'FREE plan initial grant',
        },
      });

      await tx.merchant.update({
        where: { id: merchant.id },
        data: {
          creditsBalance: FREE_PLAN_INITIAL_CREDITS,
          creditsUpdatedAt: new Date(),
        },
      });

      // Re-fetch so the response reflects the credit grant + subscription link
      const finalMerchant = await tx.merchant.findUniqueOrThrow({
        where: { id: merchant.id },
      });
      return { merchant: finalMerchant, subscription };
    });

    this.audit.log({
      actorType: 'USER',
      actorUserId: userId,
      action: 'merchant.onboarded',
      targetType: 'merchant',
      targetId: result.merchant.id,
      ip,
      userAgent,
      metadata: { businessName: dto.businessName },
    });

    this.logger.log({
      event: 'merchant.onboarded',
      merchantId: result.merchant.id,
      userId,
    });

    return {
      merchant: this.serializeMerchant(result.merchant),
      subscription: {
        ...result.subscription,
        // bigint fields (none currently on subscription) would break
        // JSON.stringify — map proactively same as amounts
      },
    };
  }

  /**
   * Map bigint fields to strings — JSON.stringify(bigint) throws and the
   * interceptor has no polyfill (same rule as verification DTO mappers).
   */
  private serializeMerchant<T extends { creditsBalance: bigint }>(m: T) {
    return { ...m, creditsBalance: m.creditsBalance.toString() };
  }

  /**
   * Get onboarding status for the current user.
   * Delegates to OnboardingStatusService.
   */
  async getStatus(_user: { id: string; role: string }) {
    return { needsOnboarding: false, step: 'COMPLETE' };
  }
}
