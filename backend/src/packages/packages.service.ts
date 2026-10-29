// ============================================================
// Yene Verify — Packages Service (Step 17)
//
// Read-only catalog reads + the merchant's own subscription state.
// No mutations, no admin surface: packages are seeded from
// shared/constants/packages.json and immutable in the MVP.
// ============================================================

import { Injectable } from '@nestjs/common';
import { NotFoundError } from '../common/errors/domain-errors';
import { PackagesRepository } from './packages.repository';
import type { PackageResponseDto, PackageListResponseDto } from './dto/package-response.dto';
import type {
  PackageUpgradeOptionDto,
  SubscriptionMeResponseDto,
} from './dto/subscription-response.dto';

const DAY_MS = 86_400_000;

/** Same warning threshold the verification gate uses (14.2 rule). */
const LOW_CREDITS_WARNING_THRESHOLD = 20n;

/** Packages a merchant cannot pay for. FREE is provisioned at onboarding. */
const NON_PURCHASABLE = new Set(['FREE']);

@Injectable()
export class PackagesService {
  constructor(private readonly repo: PackagesRepository) {}

  // ── catalog (public) ───────────────────────────────────────────────────

  private toPackageDto(p: {
    code: string;
    name: string;
    description: string | null;
    priceMinor: bigint | null;
    currency: string;
    creditsPerMonth: number | null;
    unlimited: boolean;
    isCustom: boolean;
    displayOrder: number;
  }): PackageResponseDto {
    return {
      code: p.code,
      name: p.name,
      description: p.description,
      // bigint → string: JSON.stringify(bigint) throws (no polyfill)
      priceMinor: p.priceMinor == null ? null : p.priceMinor.toString(),
      currency: p.currency,
      creditsPerMonth: p.creditsPerMonth,
      unlimited: p.unlimited,
      isCustom: p.isCustom,
      displayOrder: p.displayOrder,
    };
  }

  async list(): Promise<PackageListResponseDto> {
    const rows = await this.repo.listActive();
    return { data: rows.map((p) => this.toPackageDto(p)) };
  }

  async findOne(code: string): Promise<PackageResponseDto> {
    const p = await this.repo.findByCode(code);
    if (!p || !p.active) {
      throw new NotFoundError(`Package '${code}' not found`);
    }
    return this.toPackageDto(p);
  }

  // ── my subscription (merchant) ─────────────────────────────────────────

  /**
   * Merchant's current subscription state. Returns a defensive all-nulls
   * shape when no subscription is linked (shouldn't happen after
   * onboarding, but never 500 over a data gap).
   */
  async getMySubscription(
    merchantId: string,
    now: Date = new Date(),
  ): Promise<SubscriptionMeResponseDto> {
    const view = await this.repo.findCurrentSubscription(merchantId);
    const upgrades = await this.repo.listActive();

    const subscription = view?.subscription ?? null;
    const packageCode = subscription?.packageCode ?? null;
    const unlimited = view?.packageUnlimited ?? false;
    const creditsBalance = view?.creditsBalance ?? 0n;
    // A missing subscription is not a "low balance" — the merchant is not
    // on a finite plan at all (matches 14.2's gate semantics for other
    // non-allowed states, e.g. INSUFFICIENT_CREDITS → lowBalance false).
    const lowBalance =
      subscription != null && !unlimited && creditsBalance <= LOW_CREDITS_WARNING_THRESHOLD;

    const options: PackageUpgradeOptionDto[] =
      packageCode == null
        ? []
        : upgrades
            // Higher displayOrder only, and never the custom-priced API
            // integration package: it is negotiated with sales, not a
            // self-serve upgrade button (Step 17 e2e rule: BUSINESS →
            // [BUSINESS_PRO], BUSINESS_PRO → []).
            .filter((p) => p.displayOrder > (view?.packageDisplayOrder ?? 0) && !p.isCustom)
            .map((p) => ({
              code: p.code,
              name: p.name,
              priceMinor: p.priceMinor == null ? null : p.priceMinor.toString(),
            }));

    const daysRemaining: number | null =
      subscription?.expiresAt == null
        ? null
        : Math.max(0, Math.ceil((subscription.expiresAt.getTime() - now.getTime()) / DAY_MS));

    return {
      subscriptionId: subscription?.id ?? null,
      packageCode,
      packageName: view?.packageName ?? null,
      status: subscription?.status ?? null,
      startedAt: subscription?.startedAt?.toISOString() ?? null,
      expiresAt: subscription?.expiresAt?.toISOString() ?? null,
      cancelledAt: subscription?.cancelledAt?.toISOString() ?? null,
      autoRenew: subscription?.autoRenew ?? false,
      unlimited,
      creditsBalance: creditsBalance.toString(),
      lowBalance,
      daysRemaining,
      canRenew: packageCode != null && !NON_PURCHASABLE.has(packageCode),
      nextPackageUpgradeOptions: options,
    };
  }
}
