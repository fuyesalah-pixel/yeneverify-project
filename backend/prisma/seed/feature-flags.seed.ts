import { PrismaClient } from '@prisma/client';
import { log } from './helpers';

// ── feature-flags.seed.ts — ALWAYS RUNS (all profiles) ───────────────────
// Seeds a baseline row for each flag so the admin web (future) can list them.
// Env vars override DB values at runtime (Step 4 §18.2).
// Never deletes flags.

const FLAGS = [
  {
    key: 'ff_manual_review_enabled',
    enabled: true,
    description: 'Enable manual review queue for ambiguous verifications',
  },
  {
    key: 'ff_billing_verification_enabled',
    enabled: true,
    description: 'Enable the billing verification flow (self-serve payments)',
  },
  {
    key: 'ff_ml_insights_enabled',
    enabled: false,
    description: 'Enable ML-based analytics (false = rule-based only for MVP)',
  },
  {
    key: 'ff_duplicate_cross_merchant_alert',
    enabled: true,
    description: 'Alert admin when the same receipt is used by two different merchants',
  },
  {
    key: 'ff_credit_low_push_enabled',
    enabled: true,
    description: 'Send FCM push when a merchant reaches the 20-credit warning threshold',
  },
] as const;

export async function seedFeatureFlags(prisma: PrismaClient): Promise<void> {
  let count = 0;

  for (const flag of FLAGS) {
    await prisma.featureFlag.upsert({
      where:  { key: flag.key },
      create: { key: flag.key, enabled: flag.enabled, description: flag.description },
      update: { description: flag.description },
      // Note: we do NOT overwrite 'enabled' on update so that admin
      // changes survive re-seeding. Only description is synced.
    });
    count++;
  }

  log('feature-flags', count);
}
