// ============================================================
// Yene Verify — Packages Repository (Step 17)
//
// Read-only Prisma access for the packages catalog and the
// merchant's current subscription. No mutations exist here by
// design — packages are seeded from shared/constants/packages.json
// and managed outside the app in the MVP.
// ============================================================

import { Injectable } from '@nestjs/common';
import { PackageCode } from '@prisma/client';
import type { Package, Subscription } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface MerchantSubscriptionView {
  subscription: Subscription;
  packageName: string;
  packageUnlimited: boolean;
  packageDisplayOrder: number;
  creditsBalance: bigint;
}

@Injectable()
export class PackagesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** All active packages, catalog order (displayOrder ASC). */
  async listActive(): Promise<Package[]> {
    return this.prisma.package.findMany({
      where: { active: true },
      orderBy: { displayOrder: 'asc' },
    });
  }

  async findByCode(code: string): Promise<Package | null> {
    // findUnique with a non-enum code string makes Prisma throw a
    // "Value out of range for enum" — a 500. Guard with the client's
    // own enum so unknown codes flow through the normal 404 path.
    if (!(Object.values(PackageCode) as string[]).includes(code)) return null;
    return this.prisma.package.findUnique({ where: { code: code as PackageCode } });
  }

  /**
   * The merchant's current subscription with its package joined, plus
   * the cached credits balance. Returns null when the tenant has no
   * linked subscription (defensive — onboarding provisions one).
   */
  async findCurrentSubscription(merchantId: string): Promise<MerchantSubscriptionView | null> {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      select: {
        creditsBalance: true,
        subscriptionId: true,
        currentSubscription: {
          include: { package: { select: { name: true, unlimited: true, displayOrder: true } } },
        },
      },
    });
    if (!merchant?.subscriptionId || !merchant.currentSubscription) return null;

    return {
      subscription: merchant.currentSubscription,
      packageName:
        merchant.currentSubscription.package?.name ?? merchant.currentSubscription.packageCode,
      packageUnlimited: merchant.currentSubscription.package?.unlimited ?? false,
      packageDisplayOrder: merchant.currentSubscription.package?.displayOrder ?? 0,
      creditsBalance: merchant.creditsBalance,
    };
  }
}
