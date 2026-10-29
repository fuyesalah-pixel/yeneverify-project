// ============================================================
// Yene Verify — Subscription response DTO (Step 17)
//
// GET /subscription/me. Everything JSON-safe: bigint balance as
// string, dates as ISO strings, nulls when the merchant has no
// subscription yet (defensive — onboarding provisions one).
// ============================================================

export type SubscriptionStatusDto = 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'PENDING_PAYMENT';

export interface PackageUpgradeOptionDto {
  code: string;
  name: string;
  /** bigint as string; null when a package has no listed price (API). */
  priceMinor: string | null;
}

/** GET /subscription/me → 200 */
export interface SubscriptionMeResponseDto {
  subscriptionId: string | null;
  packageCode: string | null;
  packageName: string | null;
  status: SubscriptionStatusDto | null;
  startedAt: string | null;
  expiresAt: string | null;
  cancelledAt: string | null;
  autoRenew: boolean;
  unlimited: boolean;
  /** Current cached balance (credits_balance), bigint as string. */
  creditsBalance: string;
  /** balance <= LOW_CREDITS_WARNING_THRESHOLD on a finite plan (14.2 rule). */
  lowBalance: boolean;
  /** ceil((expiresAt - now) / day), clamped at 0 once expired; null without a subscription. */
  daysRemaining: number | null;
  /** Re-purchasable packages: everything except FREE. */
  canRenew: boolean;
  /** Active packages with a higher displayOrder than the current one. */
  nextPackageUpgradeOptions: PackageUpgradeOptionDto[];
}
