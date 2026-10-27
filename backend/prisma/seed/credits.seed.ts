import { PrismaClient } from '@prisma/client';
import { IDS } from './ids';
import { log, daysAgo } from './helpers';
import { newId } from '../../src/common/utils/uuid';

// ── credits.seed.ts — dev/staging only ───────────────────────────────────
// Builds the immutable credit ledger for each merchant, then reconciles
// the cached merchants.creditsBalance to match the ledger sum.
//
// Merchant 1 (Selam Coffee, BUSINESS): starts with 400 credits, uses 10
// Merchant 2 (Dawit Electronics, PREMIUM): unlimited plan — NO credit GRANT
// is written. The DB enforces credit_tx_amount_nonzero_check (amount <> 0),
// and unlimited plans never consume credits, so the balance stays 0. The
// subscription itself is the source of "unlimited".

export async function seedCredits(prisma: PrismaClient): Promise<void> {
  let count = 0;
  const now = new Date();

  // ── Merchant 1: BUSINESS plan (400 credits) ───────────────────────────
  // GRANT on subscription activation
  const m1Grant: { id: string; amount: bigint; balanceAfter: bigint; createdAt: Date } = {
    id:          IDS.creditGrant1,
    amount:      400n,
    balanceAfter:400n,
    createdAt:   daysAgo(15),
  };

  await prisma.creditTransaction.upsert({
    where:  { id: m1Grant.id },
    create: {
      id:             m1Grant.id,
      merchantId:     IDS.merchant1,
      type:           'GRANT',
      amount:         m1Grant.amount,
      balanceAfter:   m1Grant.balanceAfter,
      subscriptionId: IDS.subscription1,
      reason:         'BUSINESS package activation',
      createdAt:      m1Grant.createdAt,
    },
    update: {},
  });
  count++;

  // 10 CONSUME entries (one per verified transaction, days 1–10)
  let runningBalance = 400n;
  const consumeIds: string[] = [];

  for (let i = 0; i < 10; i++) {
    runningBalance -= 1n;
    const txId = newId();
    consumeIds.push(txId);
    const verificationId = (IDS as any)[`verification${i + 1}`] as string;

    // Use createMany skipDuplicates won't work on credit_transactions
    // since UPDATE is blocked by RULE. Use try/catch instead.
    try {
      await prisma.creditTransaction.create({
        data: {
          id:             txId,
          merchantId:     IDS.merchant1,
          type:           'CONSUME',
          amount:         -1n,
          balanceAfter:   runningBalance,
          verificationId: verificationId,
          reason:         'Verification credit consumption',
          createdAt:      new Date(now.getTime() - (10 - i) * 24 * 60 * 60 * 1000),
        },
      });
      count++;
    } catch {
      // Row already exists (idempotency — RULE blocks update so we skip)
    }
  }

  // Update merchant 1 cached balance (390 after 10 consumes)
  await prisma.merchant.update({
    where: { id: IDS.merchant1 },
    data: {
      creditsBalance:   runningBalance,
      creditsUpdatedAt: now,
    },
  });

  // ── Merchant 2: PREMIUM plan (unlimited — no credits consumed) ─────────
  // No credit_transactions row: the nonzero-amount constraint makes a 0-GRANT
  // impossible, and a 0-balance merchant on an unlimited plan is correct.
  // The subscription (IDS.subscription2) already records the entitlement.
  await prisma.merchant.update({
    where: { id: IDS.merchant2 },
    data: {
      creditsBalance:   0n,
      creditsUpdatedAt: now,
    },
  });

  log('credit-transactions', count);
}
