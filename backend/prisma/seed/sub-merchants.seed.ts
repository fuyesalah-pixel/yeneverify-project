import { PrismaClient } from '@prisma/client';
import { IDS } from './ids';
import { log, daysAgo } from './helpers';

// ── sub-merchants.seed.ts — dev/staging only ─────────────────────────────

export async function seedSubMerchants(prisma: PrismaClient): Promise<void> {
  const subMerchants = [
    {
      id:              IDS.subMerchant1,
      merchantId:      IDS.merchant1,
      userId:          IDS.subMerchant1User,
      branchLabel:     'Bole Branch',
      invitedByUserId: IDS.merchant1User,
      invitedAt:       daysAgo(20),
      joinedAt:        daysAgo(19),
    },
    {
      id:              IDS.subMerchant2,
      merchantId:      IDS.merchant1,
      userId:          IDS.subMerchant2User,
      branchLabel:     'Megenagna Branch',
      invitedByUserId: IDS.merchant1User,
      invitedAt:       daysAgo(15),
      joinedAt:        daysAgo(14),
    },
    {
      id:              IDS.subMerchant3,
      merchantId:      IDS.merchant2,
      userId:          IDS.subMerchant3User,
      branchLabel:     'Main Shop',
      invitedByUserId: IDS.merchant2User,
      invitedAt:       daysAgo(10),
      joinedAt:        daysAgo(9),
    },
  ];

  let count = 0;
  for (const s of subMerchants) {
    await prisma.subMerchant.upsert({
      where:  { userId: s.userId },
      create: {
        id:              s.id,
        merchantId:      s.merchantId,
        userId:          s.userId,
        branchLabel:     s.branchLabel,
        status:          'ACTIVE',
        invitedByUserId: s.invitedByUserId,
        invitedAt:       s.invitedAt,
        joinedAt:        s.joinedAt,
        permissions:     {},
      },
      update: {
        branchLabel: s.branchLabel,
        status:      'ACTIVE',
      },
    });
    count++;
  }

  log('sub-merchants', count);
}
