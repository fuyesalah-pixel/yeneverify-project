import { PrismaClient } from '@prisma/client';
import { IDS } from './ids';
import { log } from './helpers';

// ── merchants.seed.ts — dev/staging only ─────────────────────────────────
// Creates 2 demo merchants with realistic Ethiopian business details.
// credits_balance is set here as the initial cached value; credits.seed.ts
// builds the ledger and reconciles the cache afterwards.

export async function seedMerchants(prisma: PrismaClient): Promise<void> {
  const merchants = [
    {
      id:                IDS.merchant1,
      ownerUserId:       IDS.merchant1User,
      businessName:      'Selam Coffee',
      businessType:      'Cafe & Restaurant',
      city:              'Addis Ababa',
      region:            'Addis Ababa',
      status:            'ACTIVE'  as const,
      currentPackageCode:'BUSINESS' as const,
      // Will be updated by credits.seed.ts after ledger is built
      creditsBalance:    BigInt(0),
    },
    {
      id:                IDS.merchant2,
      ownerUserId:       IDS.merchant2User,
      businessName:      'Dawit Electronics',
      businessType:      'Electronics Retail',
      city:              'Adama',
      region:            'Oromia',
      status:            'ACTIVE'  as const,
      currentPackageCode:'PREMIUM' as const,
      creditsBalance:    BigInt(0),
    },
  ];

  let count = 0;
  for (const m of merchants) {
    await prisma.merchant.upsert({
      where:  { ownerUserId: m.ownerUserId },
      create: {
        id:                m.id,
        ownerUserId:       m.ownerUserId,
        businessName:      m.businessName,
        businessType:      m.businessType,
        city:              m.city,
        region:            m.region,
        status:            m.status,
        currentPackageCode:m.currentPackageCode,
        creditsBalance:    m.creditsBalance,
      },
      update: {
        businessName:      m.businessName,
        businessType:      m.businessType,
        status:            m.status,
        currentPackageCode:m.currentPackageCode,
      },
    });
    count++;
  }

  log('merchants', count);
}
