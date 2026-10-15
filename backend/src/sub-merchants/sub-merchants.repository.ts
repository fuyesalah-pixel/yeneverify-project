// ============================================================
// Yene Verify — Sub-Merchants Repository
// ============================================================

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, SubMerchantStatus } from '@prisma/client';

export interface SubMerchantRecord {
  id: string;
  merchantId: string;
  userId: string;
  branchLabel: string | null;
  status: SubMerchantStatus;
  invitedByUserId: string | null;
  invitedAt: Date | null;
  joinedAt: Date | null;
  permissions: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

@Injectable()
export class SubMerchantsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.subMerchant.findUnique({ where: { id } });
  }

  async findByUserId(userId: string) {
    return this.prisma.subMerchant.findUnique({
      where: { userId },
    });
  }

  async findByMerchantId(
    merchantId: string,
    options?: { status?: SubMerchantStatus; search?: string; page?: number; pageSize?: number },
  ) {
    const { status, search, page = 1, pageSize = 20 } = options || {};
    const where: Prisma.SubMerchantWhereInput = {
      merchantId,
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { user: { fullName: { contains: search, mode: 'insensitive' } } },
              { user: { phone: { contains: search } } },
              { branchLabel: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const result = await Promise.all([
      this.prisma.subMerchant.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: { select: { id: true, fullName: true, phone: true } },
        },
      }),
      this.prisma.subMerchant.count({ where }),
    ]);
    const items = result[0];
    const total = result[1];

    return { items, total, page, pageSize };
  }

  async countByMerchantIdAndStatus(merchantId: string, status: SubMerchantStatus) {
    return this.prisma.subMerchant.count({
      where: { merchantId, status },
    });
  }

  async countActiveAndPending(merchantId: string): Promise<number> {
    return this.prisma.subMerchant.count({
      where: {
        merchantId,
        status: { in: ['ACTIVE', 'INVITED'] },
      },
    });
  }

  async create(data: {
    id?: string;
    merchantId: string;
    userId: string;
    branchLabel?: string;
    status?: SubMerchantStatus;
    invitedByUserId?: string;
    invitedAt?: Date;
    joinedAt?: Date | null;
    permissions?: Prisma.InputJsonValue;
  }) {
    return this.prisma.subMerchant.create({
      data: {
        ...data,
        id: data.id ?? crypto.randomUUID(),
      },
    });
  }

  async update(id: string, data: Partial<{ branchLabel: string; status: SubMerchantStatus }>) {
    return this.prisma.subMerchant.update({
      where: { id },
      data,
    });
  }

  async softDelete(id: string) {
    return this.prisma.subMerchant.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'REMOVED' },
    });
  }
}
