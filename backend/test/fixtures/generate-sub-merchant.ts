// ============================================================
// Yene Verify — Test fixture: ACTIVE sub-merchant on a merchant
//
// Creates the sub-merchant's user (SUB_MERCHANT role) and the
// linking sub_merchants row. Per-run ids; the user's phone is
// unique per call (globally unique column on users).
// ============================================================

import type { PrismaService } from '../../src/prisma/prisma.service';
import type { SubMerchantStatus } from '@prisma/client';
import { newId } from '../../src/common/utils/id.util';
import { createDeviceSession } from './generate-merchant';
import { generatePhone } from './generate-phone';

export interface SubMerchantFixtureInput {
  merchantId: string;
  status?: SubMerchantStatus;
  branchLabel?: string;
  invitedByUserId?: string;
  /** Device + session + token for signed-in calls as this user. */
  withDevice?: boolean;
}

export interface SubMerchantFixture {
  userId: string;
  subMerchantId: string;
  deviceId?: string;
  sessionId?: string;
  pushToken?: string;
}

export async function createSubMerchantFixture(
  prisma: PrismaService,
  input: SubMerchantFixtureInput,
): Promise<SubMerchantFixture> {
  const userId = newId();
  const subMerchantId = newId();

  await prisma.user.create({
    data: {
      id: userId,
      phone: generatePhone(),
      phoneVerifiedAt: new Date(),
      fullName: `E2E Sub ${subMerchantId.slice(0, 8)}`,
      role: 'SUB_MERCHANT',
      status: 'ACTIVE',
    },
  });

  await prisma.subMerchant.create({
    data: {
      id: subMerchantId,
      merchantId: input.merchantId,
      userId,
      branchLabel: input.branchLabel ?? 'Main',
      status: input.status ?? 'ACTIVE',
      invitedByUserId: input.invitedByUserId ?? null,
      invitedAt: new Date(),
      joinedAt: (input.status ?? 'ACTIVE') === 'ACTIVE' ? new Date() : null,
    },
  });

  if (input.withDevice) {
    const dev = await createDeviceSession(prisma, userId);
    return { userId, subMerchantId, ...dev };
  }
  return { userId, subMerchantId };
}
