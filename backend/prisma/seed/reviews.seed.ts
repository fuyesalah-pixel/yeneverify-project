import { PrismaClient } from '@prisma/client';
import { IDS } from './ids';
import { log, daysAgo } from './helpers';

// ── reviews.seed.ts — dev/staging only ───────────────────────────────────
// 2 verification reviews:
//   1. OPEN — linked to the NEEDS_REVIEW verification
//   2. RESOLVED — demo of a completed review

export async function seedReviews(prisma: PrismaClient): Promise<void> {
  // OPEN review
  await prisma.verificationReview.upsert({
    where:  { id: IDS.review1 },
    create: {
      id:                IDS.review1,
      verificationId:    IDS.verificationReview,
      merchantId:        IDS.merchant1,
      status:            'OPEN',
      requestedByUserId: IDS.merchant1User,
      reason:            'Dashen endpoint returned partial data — please verify manually',
      createdAt:         daysAgo(3),
    },
    update: { status: 'OPEN' },
  });

  // RESOLVED review (a past one — for audit trail demo)
  await prisma.verificationReview.upsert({
    where:  { id: IDS.review2 },
    create: {
      id:                IDS.review2,
      verificationId:    IDS.verification5,   // reusing a VERIFIED verification
      merchantId:        IDS.merchant1,
      status:            'RESOLVED',
      requestedByUserId: IDS.subMerchant1User,
      reason:            'Customer claims amount is different',
      resolvedByUserId:  IDS.merchant1User,
      resolution:        'Confirmed with bank — amount matches. Receipt is genuine.',
      resolvedAt:        daysAgo(18),
      createdAt:         daysAgo(20),
    },
    update: { status: 'RESOLVED' },
  });

  log('verification-reviews', 2);
}
