// ============================================================
// Yene Verify — Onboarding Status Service
// Computes the onboarding state for the current user.
// Pending sub-merchant invites are SubMerchant rows with
// status INVITED (the invitee already has an account).
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

@Injectable()
export class OnboardingStatusService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus(user: { id: string; role: string }): Promise<OnboardingStatus> {
    // ADMIN never needs onboarding
    if (user.role === 'ADMIN') {
      return { needsOnboarding: false, step: 'COMPLETE' };
    }

    // Pending sub-merchant invite (SubMerchant row, status INVITED)
    if (user.role === 'SUB_MERCHANT') {
      const sub = await this.prisma.subMerchant.findFirst({
        where: { userId: user.id, deletedAt: null, status: 'INVITED' },
        include: { merchant: { select: { businessName: true } } },
      });

      if (sub) {
        return {
          needsOnboarding: true,
          step: 'SUB_MERCHANT_ACCEPT',
          pendingInvite: {
            id: sub.id,
            merchantName: sub.merchant.businessName,
            branchLabel: sub.branchLabel ?? undefined,
          },
        };
      }
    }

    // Merchant onboarding
    if (user.role === 'MERCHANT') {
      const merchant = await this.prisma.merchant.findUnique({
        where: { ownerUserId: user.id },
        select: { id: true },
      });

      if (!merchant) {
        return { needsOnboarding: true, step: 'MERCHANT_PROFILE' };
      }
    }

    return { needsOnboarding: false, step: 'COMPLETE' };
  }
}
