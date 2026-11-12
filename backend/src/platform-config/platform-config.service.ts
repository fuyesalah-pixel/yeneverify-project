// ============================================================
// Yene Verify — Platform Config Service (Phase E)
//
// Central read/write access to admin-editable platform settings:
//   - feature flags (feature_flags rows, env supplies defaults)
//   - payment destinations shown to merchants during billing
//
// Runtime consumers (billing) read through this service, so an admin
// change takes effect on the next request without a redeploy.
// ============================================================

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../config/config.service';

export const PAYMENT_SETTINGS_KEY = 'payment.instructions';

export interface PaymentInstructions {
  accountName: string;
  cbeAccountNumber: string;
  telebirrPhoneNumber: string;
  instructionsNote: string;
}

export interface PaymentInstructionsView extends PaymentInstructions {
  source: 'db' | 'env';
  updatedAt: string | null;
}

export interface FeatureFlagView {
  key: string;
  envKey: string | null;
  label: string;
  description: string;
  enabled: boolean;
  envDefault: boolean | null;
  updatedAt: string | null;
}

interface FlagCatalogEntry {
  key: string;
  envKey: string | null;
  label: string;
  description: string;
}

/**
 * The five flags seeded by prisma/seed/feature-flags.seed.ts. Env keys
 * exist for the first three; the last two are database-only.
 */
const FLAG_CATALOG: readonly FlagCatalogEntry[] = [
  {
    key: 'ff_manual_review_enabled',
    envKey: 'FF_MANUAL_REVIEW_ENABLED',
    label: 'Manual review queue',
    description: 'Send ambiguous verifications to the review queue instead of auto-verdicts.',
  },
  {
    key: 'ff_billing_verification_enabled',
    envKey: 'FF_BILLING_VERIFICATION_ENABLED',
    label: 'Billing verification',
    description: 'Allow merchants to pay for plans by submitting a bank transfer receipt.',
  },
  {
    key: 'ff_ml_insights_enabled',
    envKey: 'FF_ML_INSIGHTS_ENABLED',
    label: 'ML insights',
    description: 'Use ML-based analytics; when off only rule-based insights are shown.',
  },
  {
    key: 'ff_duplicate_cross_merchant_alert',
    envKey: null,
    label: 'Cross-merchant duplicate alerts',
    description: 'Alert admins when the same receipt is used by two different merchants.',
  },
  {
    key: 'ff_credit_low_push_enabled',
    envKey: null,
    label: 'Low-credit push alerts',
    description: 'Push a notification when a merchant reaches the 20-credit warning threshold.',
  },
];

export const PLATFORM_FLAG_KEYS = FLAG_CATALOG.map((entry) => entry.key);

@Injectable()
export class PlatformConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  private envFlagValue(envKey: string | null): boolean | null {
    if (!envKey) return null;
    const features = this.config.features;
    switch (envKey) {
      case 'FF_MANUAL_REVIEW_ENABLED':
        return features.manualReviewEnabled;
      case 'FF_BILLING_VERIFICATION_ENABLED':
        return features.billingVerificationEnabled;
      case 'FF_ML_INSIGHTS_ENABLED':
        return features.mlInsightsEnabled;
      default:
        return null;
    }
  }

  /**
   * All catalogued flags with the effective value. A database row wins;
   * the env value is only the fallback and what the UI labels as default.
   */
  async listFlags(): Promise<FeatureFlagView[]> {
    const rows = await this.prisma.featureFlag.findMany({
      where: { key: { in: PLATFORM_FLAG_KEYS } },
    });
    const byKey = new Map(rows.map((row) => [row.key, row]));

    return FLAG_CATALOG.map((entry) => {
      const row = byKey.get(entry.key);
      const envDefault = this.envFlagValue(entry.envKey);
      return {
        key: entry.key,
        envKey: entry.envKey,
        label: entry.label,
        description: row?.description ?? entry.description,
        enabled: row?.enabled ?? envDefault ?? false,
        envDefault,
        updatedAt: row ? row.updatedAt.toISOString() : null,
      };
    });
  }

  async setFlag(
    key: string,
    enabled: boolean,
  ): Promise<{ flag: FeatureFlagView; previous: boolean | null }> {
    const entry = FLAG_CATALOG.find((item) => item.key === key);
    if (!entry) {
      throw new Error(`Unknown feature flag: ${key}`);
    }

    const existing = await this.prisma.featureFlag.findUnique({ where: { key } });
    const previous = existing ? existing.enabled : null;
    const row = await this.prisma.featureFlag.upsert({
      where: { key },
      create: { key, enabled, description: entry.description },
      update: { enabled },
    });

    return {
      flag: {
        key: row.key,
        envKey: entry.envKey,
        label: entry.label,
        description: row.description ?? entry.description,
        enabled: row.enabled,
        envDefault: this.envFlagValue(entry.envKey),
        updatedAt: row.updatedAt.toISOString(),
      },
      previous,
    };
  }

  /**
   * Payment instructions merchants see during billing. Database values
   * win; env values are the fallback until an admin saves a change.
   */
  async getPaymentInstructions(): Promise<PaymentInstructionsView> {
    const [row, env] = await Promise.all([
      this.prisma.platformSetting.findUnique({ where: { key: PAYMENT_SETTINGS_KEY } }),
      Promise.resolve(this.config.payment),
    ]);

    const stored = (row?.value ?? {}) as Partial<PaymentInstructions>;
    return {
      accountName: stored.accountName ?? env.accountName,
      cbeAccountNumber: stored.cbeAccountNumber ?? env.destinationCbe,
      telebirrPhoneNumber: stored.telebirrPhoneNumber ?? env.destinationTelebirr,
      instructionsNote: stored.instructionsNote ?? env.instructionsNote,
      source: row ? 'db' : 'env',
      updatedAt: row ? row.updatedAt.toISOString() : null,
    };
  }

  async setPaymentInstructions(
    input: PaymentInstructions,
    actorUserId: string,
  ): Promise<{ next: PaymentInstructionsView; previous: PaymentInstructionsView }> {
    const previous = await this.getPaymentInstructions();
    const value = input as unknown as Prisma.InputJsonValue;
    await this.prisma.platformSetting.upsert({
      where: { key: PAYMENT_SETTINGS_KEY },
      create: {
        key: PAYMENT_SETTINGS_KEY,
        value,
        updatedByUserId: actorUserId,
      },
      update: {
        value,
        updatedByUserId: actorUserId,
      },
    });

    const next = await this.getPaymentInstructions();
    return { next, previous };
  }
}
