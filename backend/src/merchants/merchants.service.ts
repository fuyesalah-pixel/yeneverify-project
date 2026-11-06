// ============================================================
// Yene Verify — Merchants Service
// Handles merchant profile management.
// ============================================================

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotFoundError } from '../common/errors/domain-errors';
import type { UpdateMerchantDto } from './dto/merchant.dto';
import type { VerificationAccountsUpdate } from './dto/verification-accounts.dto';
import { mergeVerificationAccounts, normalizeVerificationAccounts } from './verification-accounts';

const MeInclude = {
  currentSubscription: {
    select: { id: true, packageCode: true, status: true, expiresAt: true },
  },
  _count: {
    select: {
      subMerchants: true,
      transactions: true,
      verifications: true,
    },
  },
} as const;

@Injectable()
export class MerchantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getMe(merchantId: string) {
    return this.prisma.merchant.findUnique({
      where: { id: merchantId },
      include: MeInclude,
    });
  }

  /**
   * Fallback for tokens issued BEFORE onboarding (no merchantId claim yet):
   * resolve the merchant owned by this user.
   */
  async getMeByOwner(ownerUserId: string) {
    return this.prisma.merchant.findUnique({
      where: { ownerUserId },
      include: MeInclude,
    });
  }

  async updateMe(
    merchantId: string,
    dto: UpdateMerchantDto & {
      businessName?: string;
      businessType?: string;
      tin?: string;
      address?: string;
      city?: string;
      region?: string;
    },
  ) {
    return this.prisma.merchant.update({
      where: { id: merchantId },
      data: {
        businessName: dto.businessName,
        businessType: dto.businessType,
        tin: dto.tin,
        address: dto.address,
        city: dto.city,
        region: dto.region,
      },
    });
  }

  // ── Verification accounts ─────────────────────────────────────────────

  async getVerificationAccounts(user: { id: string; merchantId?: string }) {
    const merchant = await this.requireMerchant(user);
    return normalizeVerificationAccounts(merchant.verificationAccounts);
  }

  /**
   * Merge a partial settings update and persist it. Values are never
   * written to the audit log — only which banks changed.
   */
  async updateVerificationAccounts(
    user: { id: string; merchantId?: string },
    patch: VerificationAccountsUpdate,
    ip?: string,
    userAgent?: string,
  ) {
    const merchant = await this.requireMerchant(user);
    const merged = mergeVerificationAccounts(merchant.verificationAccounts, patch);

    await this.prisma.merchant.update({
      where: { id: merchant.id },
      data: { verificationAccounts: merged as Prisma.InputJsonValue },
    });

    this.audit.log({
      actorType: 'USER',
      actorUserId: user.id,
      action: 'merchant.verification_accounts.updated',
      targetType: 'merchant',
      targetId: merchant.id,
      ip,
      userAgent,
      metadata: { merchantId: merchant.id, banks: Object.keys(merged) },
    });

    return merged;
  }

  private async requireMerchant(user: { id: string; merchantId?: string }) {
    const merchant = await this.prisma.merchant.findUnique({
      where: user.merchantId ? { id: user.merchantId } : { ownerUserId: user.id },
      select: { id: true, verificationAccounts: true },
    });
    if (!merchant) {
      throw new NotFoundError('No merchant profile found for this user');
    }
    return merchant;
  }
}
