// ============================================================
// Yene Verify — Test fixture: onboarded merchant bundle
//
// Creates the full FK chain a merchant-guarded endpoint needs:
//   owner user (MERCHANT) → merchant → package (upserted,
//     shared/seeded) → ACTIVE subscription (+30 days)
//   (+ optional device + session for signed-in API calls,
//    + optional initial credits via an immutable GRANT ledger row
//    so the merchant.creditsBalance cache stays reconciled.)
//
// All ids are fresh UUIDs per call — parallel suites never collide.
// Immutable-ledger tables (credit_transactions) are only ever
// INSERTed here, matching the DB rules.
// ============================================================

import type { PrismaService } from '../../src/prisma/prisma.service';
import type { PackageCode } from '@prisma/client';
import { newId } from '../../src/common/utils/id.util';
import { createHash, randomBytes } from 'crypto';
import { generatePhone } from './generate-phone';

const DAY_MS = 86_400_000;

export interface MerchantFixtureInput {
  /** Defaults: valid per-run phone, 'E2E <context> Merchant'. */
  phone?: string;
  businessName?: string;
  packageCode?: PackageCode;
  /** > 0 sets creditsBalance cache AND writes the GRANT ledger row. */
  initialCredits?: number;
  /** Creates a device + session (for TokenService signing). */
  withDevice?: boolean;
}

export interface MerchantFixture {
  userId: string;
  merchantId: string;
  subscriptionId: string;
  deviceId?: string;
  sessionId?: string;
  pushToken?: string;
}

/** Upserts the shared package row — safe to call from every suite. */
export async function ensurePackage(
  prisma: PrismaService,
  code: PackageCode = 'BUSINESS',
): Promise<void> {
  const base: Record<string, { name: string; priceMinor: bigint; creditsPerMonth: number }> = {
    FREE: { name: 'Free', priceMinor: 0n, creditsPerMonth: 10 },
    PREMIUM: { name: 'Premium', priceMinor: 49900n, creditsPerMonth: 100 },
    BUSINESS: { name: 'Business', priceMinor: 99900n, creditsPerMonth: 400 },
    BUSINESS_PRO: { name: 'Business Pro', priceMinor: 249900n, creditsPerMonth: 1200 },
    API: { name: 'API', priceMinor: 499900n, creditsPerMonth: 3000 },
  };
  const p = base[code];
  await prisma.package.upsert({
    where: { code },
    update: {},
    create: {
      code,
      name: p?.name ?? code,
      priceMinor: p?.priceMinor ?? 99900n,
      creditsPerMonth: p?.creditsPerMonth ?? 100,
      unlimited: false,
    },
  });
}

export async function createDeviceSession(
  prisma: PrismaService,
  userId: string,
): Promise<{ deviceId: string; sessionId: string; pushToken: string }> {
  const deviceId = newId();
  const sessionId = newId();
  const pushToken = `fcm-fix-${randomBytes(8).toString('hex')}`;

  await prisma.device.create({
    data: {
      id: deviceId,
      userId,
      deviceFingerprint: `fx-dev-${randomBytes(8).toString('hex')}`,
      platform: 'ANDROID',
      pushToken,
    },
  });
  await prisma.session.create({
    data: {
      id: sessionId,
      userId,
      deviceId,
      refreshTokenHash: createHash('sha256')
        .update(`fx-refresh-${randomBytes(16).toString('hex')}`)
        .digest('hex'),
      expiresAt: new Date(Date.now() + 2 * 3_600_000),
    },
  });
  return { deviceId, sessionId, pushToken };
}

export async function createMerchantFixture(
  prisma: PrismaService,
  input: MerchantFixtureInput = {},
): Promise<MerchantFixture> {
  const userId = newId();
  const merchantId = newId();
  const subscriptionId = newId();
  const packageCode = input.packageCode ?? 'BUSINESS';
  const phone = input.phone ?? generatePhone();

  await prisma.user.create({
    data: {
      id: userId,
      phone,
      phoneVerifiedAt: new Date(),
      fullName: `E2E Owner ${merchantId.slice(0, 8)}`,
      role: 'MERCHANT',
      status: 'ACTIVE',
    },
  });

  await prisma.merchant.create({
    data: {
      id: merchantId,
      ownerUserId: userId,
      businessName: input.businessName ?? `E2E Coffee ${merchantId.slice(0, 8)}`,
      status: 'ACTIVE',
      creditsBalance: BigInt(input.initialCredits ?? 0),
      creditsUpdatedAt: input.initialCredits ? new Date() : null,
    },
  });

  await ensurePackage(prisma, packageCode);

  await prisma.subscription.create({
    data: {
      id: subscriptionId,
      merchantId,
      packageCode,
      status: 'ACTIVE',
      autoRenew: false,
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * DAY_MS),
    },
  });

  // Merchant.subscriptionId is self-set (SetNull FK to subscriptions).
  await prisma.merchant.update({ where: { id: merchantId }, data: { subscriptionId } });

  if (input.initialCredits && input.initialCredits > 0) {
    await prisma.creditTransaction.create({
      data: {
        id: newId(),
        type: 'GRANT',
        merchantId,
        amount: BigInt(input.initialCredits),
        balanceAfter: BigInt(input.initialCredits),
        subscriptionId,
        reason: 'e2e fixture initial credits',
      },
    });
  }

  if (input.withDevice) {
    const dev = await createDeviceSession(prisma, userId);
    return { userId, merchantId, subscriptionId, ...dev };
  }

  return { userId, merchantId, subscriptionId };
}
