import { PrismaClient } from '@prisma/client';
import { IDS } from './ids';
import { log, daysAgo, daysFromNow } from './helpers';

// ── subscriptions.seed.ts — dev/staging only ─────────────────────────────

export async function seedSubscriptions(prisma: PrismaClient): Promise<void> {
  const subs = [
    {
      id:          IDS.subscription1,
      merchantId:  IDS.merchant1,
      packageCode: 'BUSINESS' as const,
      status:      'ACTIVE'   as const,
      startedAt:   daysAgo(15),
      expiresAt:   daysFromNow(15),
    },
    {
      id:          IDS.subscription2,
      merchantId:  IDS.merchant2,
      packageCode: 'PREMIUM'  as const,
      status:      'ACTIVE'   as const,
      startedAt:   daysAgo(20),
      expiresAt:   daysFromNow(10),
    },
  ];

  let count = 0;
  for (const s of subs) {
    await prisma.subscription.upsert({
      where:  { id: s.id },
      create: {
        id:          s.id,
        merchantId:  s.merchantId,
        packageCode: s.packageCode,
        status:      s.status,
        startedAt:   s.startedAt,
        expiresAt:   s.expiresAt,
        autoRenew:   false,
      },
      update: {
        status:    s.status,
        expiresAt: s.expiresAt,
      },
    });
    count++;
  }

  // Link merchants to their active subscription
  await prisma.merchant.update({
    where: { id: IDS.merchant1 },
    data:  { subscriptionId: IDS.subscription1 },
  });
  await prisma.merchant.update({
    where: { id: IDS.merchant2 },
    data:  { subscriptionId: IDS.subscription2 },
  });

  log('subscriptions', count);
}
