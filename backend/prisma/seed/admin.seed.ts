import { PrismaClient } from '@prisma/client';
import { IDS, PHONES } from './ids';
import { log, maskPhone } from './helpers';

// ── admin.seed.ts — ALWAYS RUNS (all profiles) ────────────────────────────
// Creates the platform owner (Fuad) using env-configured phone + name.
// Production-safe: never creates fake admins.
// Upserts by phone — idempotent.

export async function seedAdmin(prisma: PrismaClient): Promise<void> {
  const phone = process.env.ADMIN_BOOTSTRAP_PHONE ?? PHONES.admin;
  const name  = process.env.ADMIN_BOOTSTRAP_NAME  ?? 'Fuad';

  await prisma.user.upsert({
    where: { phone },
    create: {
      id:                IDS.adminUser,
      phone,
      fullName:          name,
      role:              'ADMIN',
      status:            'ACTIVE',
      preferredLanguage: 'en',
      phoneVerifiedAt:   new Date(),
    },
    update: {
      fullName: name,
      status:   'ACTIVE',
    },
  });

  console.log(`[seed] admin                           → ${maskPhone(phone)}`);
  log('admin', 1);
}
