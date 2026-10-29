// ============================================================
// Yene Verify — Test fixture: between-runs state helper
//
// Best-effort cleanup for fixture-created rows. Deliberately
// SKIPS the immutable/anti-tamper tables — credit_transactions
// and audit_logs cannot and must not be deleted (Postgres RULEs
// block it) — and the merchant/user/subscription rows that
// participate in those rules. Fresh per-run UUIDs make leaving
// them behind harmless (same policy as the existing suites).
//
// Never throws: deletion is best-effort so afterAll cannot mask
// the real test outcome.
// ============================================================

import type { PrismaService } from '../../src/prisma/prisma.service';

export interface ResetScope {
  userIds?: string[];
  merchantIds?: string[];
}

export async function resetFixtureState(prisma: PrismaService, scope: ResetScope): Promise<void> {
  const { userIds = [], merchantIds = [] } = scope;
  const safe = async (op: Promise<unknown>) => {
    await op.catch(() => undefined);
  };

  // Children first, parents never (immutable-ledger rules).
  await safe(prisma.notification.deleteMany({ where: { userId: { in: [...userIds] } } }));
  if (userIds.length > 0) {
    await safe(prisma.session.deleteMany({ where: { userId: { in: userIds } } }));
    await safe(prisma.device.deleteMany({ where: { userId: { in: userIds } } }));
  }
  if (merchantIds.length > 0) {
    // verifications may be referenced by RESTRICT FKs on the ledger.
    await safe(prisma.transaction.deleteMany({ where: { merchantId: { in: merchantIds } } }));
    await safe(prisma.verification.deleteMany({ where: { merchantId: { in: merchantIds } } }));
    await safe(prisma.receipt.deleteMany({ where: { merchantId: { in: merchantIds } } }));
  }
}
