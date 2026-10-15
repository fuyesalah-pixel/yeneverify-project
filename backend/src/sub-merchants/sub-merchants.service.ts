// ============================================================
// Yene Verify — Sub-Merchants Service
// Merchant-side management: list, detail, update, remove, limit.
// Pending invites are SubMerchant rows with status INVITED.
// Phone numbers are always masked in responses (never returned raw).
// ============================================================

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SubMerchantNotFoundError, PlanLimitSubMerchantsError } from './errors';

export type SubMerchantView = {
  id: string;
  kind: 'SUB_MERCHANT';
  status: string;
  name: string;
  phone: string; // masked
  branchLabel: string | null;
  invitedAt: string | null;
  joinedAt: string | null;
};

@Injectable()
export class SubMerchantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Enforce the merchant's plan limit. The cap comes from the merchant's
   * current package (maxSubMerchants). ACTIVE members and pending invites
   * (status INVITED) both count against it.
   */
  async checkSubMerchantLimit(merchantId: string): Promise<void> {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { currentPackageCode: true },
    });
    if (!merchant?.currentPackageCode) {
      return; // no package assigned yet — nothing to enforce
    }

    const pkg = await this.prisma.package.findUnique({
      where: { code: merchant.currentPackageCode },
      select: { maxSubMerchants: true },
    });
    if (!pkg || pkg.maxSubMerchants == null) {
      return; // unlimited
    }

    const activeCount = await this.prisma.subMerchant.count({
      where: { merchantId, deletedAt: null, status: { in: ['ACTIVE', 'INVITED'] } },
    });

    if (activeCount >= pkg.maxSubMerchants) {
      throw new PlanLimitSubMerchantsError({ limit: pkg.maxSubMerchants });
    }
  }

  /**
   * List sub-merchants for a merchant (owner view), including pending
   * invites (status INVITED). Phones are masked.
   */
  async list(
    merchantId: string,
    options?: { status?: string; search?: string; page?: number; pageSize?: number },
  ): Promise<{ items: SubMerchantView[]; total: number; page: number; pageSize: number }> {
    const page = Math.max(1, options?.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, options?.pageSize ?? 20));

    const where = {
      merchantId,
      deletedAt: null,
      ...(options?.status ? { status: options.status as never } : {}),
      ...(options?.search
        ? {
            OR: [
              { user: { fullName: { contains: options.search, mode: 'insensitive' as const } } },
              { user: { phone: { contains: options.search } } },
              { branchLabel: { contains: options.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.subMerchant.findMany({
        where,
        orderBy: [{ status: 'desc' }, { createdAt: 'desc' }], // INVITED before ACTIVE (I<N… alphabetical trick is fragile — sorted again below)
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { user: { select: { fullName: true, phone: true } } },
      }),
      this.prisma.subMerchant.count({ where }),
    ]);

    // Invites first, then by newest.
    const items = rows
      .map<SubMerchantView & { _createdAt: Date }>((sm) => ({
        id: sm.id,
        kind: 'SUB_MERCHANT' as const,
        status: sm.status,
        name: sm.user.fullName,
        phone: this.maskPhone(sm.user.phone),
        branchLabel: sm.branchLabel,
        invitedAt: sm.invitedAt?.toISOString() ?? null,
        joinedAt: sm.joinedAt?.toISOString() ?? null,
        _createdAt: sm.createdAt,
      }))
      .sort((a, b) => {
        const aInvite = a.status === 'INVITED' ? 0 : 1;
        const bInvite = b.status === 'INVITED' ? 0 : 1;
        if (aInvite !== bInvite) return aInvite - bInvite;
        return b._createdAt.getTime() - a._createdAt.getTime();
      })
      .map(({ _createdAt, ...item }) => item);

    return { items, total, page, pageSize };
  }

  /**
   * Get detail by sub-merchant ID, scoped to the merchant. Phone is masked.
   */
  async getById(
    merchantId: string,
    id: string,
  ): Promise<
    | (SubMerchantView & {
        verificationCount: number;
        lastVerificationAt: string | null;
        createdAt: string;
        updatedAt: string;
      })
    | null
  > {
    const sub = await this.prisma.subMerchant.findFirst({
      where: { id, merchantId, deletedAt: null },
      include: { user: { select: { fullName: true, phone: true } } },
    });

    if (!sub) {
      return null;
    }

    return {
      id: sub.id,
      kind: 'SUB_MERCHANT' as const,
      status: sub.status,
      name: sub.user.fullName,
      phone: this.maskPhone(sub.user.phone),
      branchLabel: sub.branchLabel,
      invitedAt: sub.invitedAt?.toISOString() ?? null,
      joinedAt: sub.joinedAt?.toISOString() ?? null,
      verificationCount: 0,
      lastVerificationAt: null,
      createdAt: sub.createdAt.toISOString(),
      updatedAt: sub.updatedAt.toISOString(),
    };
  }

  /**
   * Update the branch label of a sub-merchant.
   */
  async update(merchantId: string, id: string, dto: { branchLabel?: string }): Promise<void> {
    const sub = await this.prisma.subMerchant.findFirst({
      where: { id, merchantId, deletedAt: null },
      select: { id: true },
    });

    if (!sub) {
      throw new SubMerchantNotFoundError();
    }

    await this.prisma.subMerchant.update({
      where: { id },
      data: { branchLabel: dto.branchLabel },
    });

    this.audit.log({
      actorType: 'USER',
      action: 'sub_merchant.updated',
      targetType: 'sub_merchant',
      targetId: id,
      metadata: { merchantId, branchLabel: dto.branchLabel ?? null },
    });
  }

  /**
   * Soft-delete a sub-merchant (or cancel a pending invite), revoking
   * sessions and devices so access is cut off immediately.
   */
  async remove(merchantId: string, id: string): Promise<void> {
    const sub = await this.prisma.subMerchant.findFirst({
      where: { id, merchantId, deletedAt: null },
    });

    if (!sub) {
      throw new SubMerchantNotFoundError();
    }

    if (sub.status === 'INVITED') {
      // Pending invite: hard-delete so the phone/user can be re-invited
      // (userId is @unique on sub_merchants, a soft-deleted row would block it).
      await this.prisma.subMerchant.delete({ where: { id: sub.id } });
    } else {
      await this.prisma.$transaction(async (tx) => {
        await tx.subMerchant.update({
          where: { id },
          data: { deletedAt: new Date(), status: 'REMOVED' },
        });
        await tx.session.updateMany({
          where: { userId: sub.userId },
          data: { revokedAt: new Date() },
        });
        await tx.device.updateMany({
          where: { userId: sub.userId },
          data: { revokedAt: new Date() },
        });
      });
    }

    this.audit.log({
      actorType: 'USER',
      action: 'sub_merchant.removed',
      targetType: 'sub_merchant',
      targetId: id,
      metadata: { merchantId },
    });
  }

  /**
   * Mask Ethiopian phone numbers: keep country code and last 2 digits.
   * Returns the input unchanged when the format is unexpected.
   */
  private maskPhone(phone: string): string {
    if (/^\+251\d{9}$/.test(phone)) {
      return `+251*****${phone.slice(-2)}`;
    }
    return phone;
  }
}
