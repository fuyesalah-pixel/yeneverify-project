import { PrismaClient } from '@prisma/client';
import { IDS, PHONES } from './ids';
import { log } from './helpers';

// ── users.seed.ts — dev/staging only ─────────────────────────────────────
// Creates merchant owner users and sub-merchant users.
// Real-ish Ethiopian names. All phones from PHONES. All IDs from IDS.

export async function seedUsers(prisma: PrismaClient): Promise<void> {
  const users = [
    {
      id:                IDS.merchant1User,
      phone:             PHONES.merchant1,
      fullName:          'Selam Tadesse',
      role:              'MERCHANT' as const,
      preferredLanguage: 'am',
    },
    {
      id:                IDS.merchant2User,
      phone:             PHONES.merchant2,
      fullName:          'Dawit Bekele',
      role:              'MERCHANT' as const,
      preferredLanguage: 'en',
    },
    {
      id:                IDS.subMerchant1User,
      phone:             PHONES.subMerchant1,
      fullName:          'Hanna Girma',
      role:              'SUB_MERCHANT' as const,
      preferredLanguage: 'am',
    },
    {
      id:                IDS.subMerchant2User,
      phone:             PHONES.subMerchant2,
      fullName:          'Bereket Alemu',
      role:              'SUB_MERCHANT' as const,
      preferredLanguage: 'en',
    },
    {
      id:                IDS.subMerchant3User,
      phone:             PHONES.subMerchant3,
      fullName:          'Meron Haile',
      role:              'SUB_MERCHANT' as const,
      preferredLanguage: 'am',
    },
  ];

  let count = 0;
  for (const u of users) {
    await prisma.user.upsert({
      where:  { phone: u.phone },
      create: {
        id:                u.id,
        phone:             u.phone,
        fullName:          u.fullName,
        role:              u.role,
        status:            'ACTIVE',
        preferredLanguage: u.preferredLanguage,
        phoneVerifiedAt:   new Date(),
      },
      update: {
        fullName:          u.fullName,
        status:            'ACTIVE',
        preferredLanguage: u.preferredLanguage,
      },
    });
    count++;
  }

  log('users (dev)', count);
}
