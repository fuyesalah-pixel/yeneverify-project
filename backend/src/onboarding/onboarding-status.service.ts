// ============================================================
// Yene Verify — Onboarding Status Service
// Computes the onboarding state for the current user.
//
// A pending sub-merchant invite is a SubMerchant row with status
// INVITED. Role transitions happen at ACCEPT time, not invite time
// (Step 9's provisional MERCHANT role), so the invite check must run
// regardless of the user's current role — otherwise an invited
// MERCHANT is told to create a merchant profile instead of being
// shown the invite.
// ============================================================

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type OnboardingStep =
  'COMPLETE' | 'MERCHANT_PROFILE' | 'SUB_MERCHANT_ACCEPT' | 'SUB_MERCHANT_PROFILE';

export interface PendingInviteInfo {
  id: string;
  merchantName: string;
  branchLabel?: string;
}

export interface OnboardingStatus {
  needsOnboarding: boolean;
  step: OnboardingStep;
  pendingInvite?: {
    id: string;
    merchantName: string;
    branchLabel?: string;
  };
}

/** Must match the row-expiry window enforced by acceptInvite (7 days). */
const INVITE_ROW_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class OnboardingStatusService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus(user: { id: string; role: string }): Promise<OnboardingStatus> {
    // ADMIN never needs onboarding
    if (user.role === 'ADMIN') {
      return { needsOnboarding: false, step: 'COMPLETE' };
    }

    // 1. Pending invite takes precedence over everything else. Invites are
    //    linked by user id (the invitee must already have an account), so a
    //    phone change after the invite does not orphan it.
    const pendingInvite = await this.prisma.subMerchant.findFirst({
      where: {
        userId: user.id,
        deletedAt: null,
        status: 'INVITED',
        invitedAt: { gt: new Date(Date.now() - INVITE_ROW_TTL_MS) },
      },
      orderBy: { invitedAt: 'desc' },
      include: { merchant: { select: { businessName: true } } },
    });

    if (pendingInvite) {
      return {
        needsOnboarding: true,
        step: 'SUB_MERCHANT_ACCEPT',
        pendingInvite: {
          id: pendingInvite.id,
          merchantName: pendingInvite.merchant.businessName,
          branchLabel: pendingInvite.branchLabel ?? undefined,
        },
      };
    }

    // 2. An accepted (ACTIVE) membership means onboarding is done, even
    //    though the access token still carries the pre-accept MERCHANT role.
    const activeMembership = await this.prisma.subMerchant.findFirst({
      where: { userId: user.id, deletedAt: null, status: 'ACTIVE' },
      select: { id: true },
    });
    if (activeMembership) {
      return { needsOnboarding: false, step: 'COMPLETE' };
    }

    // 3. Merchant onboarding
    if (user.role === 'MERCHANT') {
      const merchant = await this.prisma.merchant.findUnique({
        where: { ownerUserId: user.id },
        select: { id: true },
      });

      if (!merchant) {
        return { needsOnboarding: true, step: 'MERCHANT_PROFILE' };
      }
      return { needsOnboarding: false, step: 'COMPLETE' };
    }

    // 4. SUB_MERCHANT with no active membership (removed/declined) — they
    //    have to onboard as a merchant themselves.
    if (user.role === 'SUB_MERCHANT') {
      return { needsOnboarding: true, step: 'MERCHANT_PROFILE' };
    }

    return { needsOnboarding: false, step: 'COMPLETE' };
  }
}
