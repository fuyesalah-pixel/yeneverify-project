import { PrismaClient } from '@prisma/client';
import {
  SeedProfile,
  resolveProfile,
  assertProfileAllowed,
  isFullProfile,
} from './profiles';
import { logSummary } from './helpers';

import { seedPackages }      from './packages.seed';
import { seedFeatureFlags }  from './feature-flags.seed';
import { seedAdmin }         from './admin.seed';
import { seedUsers }         from './users.seed';
import { seedMerchants }     from './merchants.seed';
import { seedSubMerchants }  from './sub-merchants.seed';
import { seedSubscriptions } from './subscriptions.seed';
import { seedCredits }       from './credits.seed';
import { seedReceipts }      from './receipts.seed';
import { seedVerifications } from './verifications.seed';
import { seedTransactions }  from './transactions.seed';
import { seedBilling }       from './billing.seed';
import { seedReviews }       from './reviews.seed';
import { seedNotifications } from './notifications.seed';
import { seedAudit }         from './audit.seed';

export { SeedProfile, resolveProfile };

// ============================================================
// runSeed — orchestrates all seed modules in dependency order
//
// Order is strict:
//   1. Catalog (packages, flags) — no deps
//   2. Auth (admin, users) — no deps
//   3. Merchants — depends on users
//   4. Sub-merchants — depends on merchants + users
//   5. Subscriptions — depends on merchants + packages
//   6. Credits — depends on subscriptions + verifications (future)
//   7. Receipts — depends on merchants + users
//   8. Verifications — depends on receipts + fixtures
//   9. Transactions — depends on verifications
//  10. Billing — depends on receipts + verifications
//  11. Reviews — depends on verifications
//  12. Notifications — depends on merchants + users + verifications
//  13. Audit — depends on everything above
// ============================================================

export async function runSeed(
  prisma: PrismaClient,
  profile?: SeedProfile,
): Promise<void> {
  const activeProfile = profile ?? resolveProfile();
  assertProfileAllowed(activeProfile);

  console.log('');
  console.log(`╔═══════════════════════════════════════════════════╗`);
  console.log(`║  Yene Verify — Database Seed                      ║`);
  console.log(`║  Profile: ${activeProfile.padEnd(8)} │ NODE_ENV: ${(process.env.NODE_ENV ?? 'development').padEnd(11)} ║`);
  console.log(`╚═══════════════════════════════════════════════════╝`);
  console.log('');

  // ── Always: catalog + admin ───────────────────────────────────────────
  await seedPackages(prisma);
  await seedFeatureFlags(prisma);
  await seedAdmin(prisma);

  // ── Dev / staging: full demo data ─────────────────────────────────────
  if (isFullProfile(activeProfile)) {
    await seedUsers(prisma);
    await seedMerchants(prisma);
    await seedSubMerchants(prisma);
    await seedSubscriptions(prisma);
    await seedReceipts(prisma);
    await seedVerifications(prisma);
    await seedTransactions(prisma);
    await seedCredits(prisma);
    await seedBilling(prisma);
    await seedReviews(prisma);
    await seedNotifications(prisma);
    await seedAudit(prisma);
  }

  logSummary(activeProfile);
}
