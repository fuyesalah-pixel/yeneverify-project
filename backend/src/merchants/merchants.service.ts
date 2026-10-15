// ============================================================
// Yene Verify — Merchants Service
// Handles merchant profile management.
// ============================================================

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { UpdateMerchantDto } from './dto/merchant.dto';

@Injectable()
export class MerchantsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(merchantId: string) {
    return this.prisma.merchant.findUnique({
      where: { id: merchantId },
      include: {
        currentSubscription: {
          select: { id: true, packageCode: true, status: true, expiresAt: true },
        },
        _count: {
          select: {
            subMerchants: true,
            transactions: true,
            verifications: true,
          },
        },
      },
    });
  }

  async updateMe(
    merchantId: string,
    dto: UpdateMerchantDto & {
      businessName?: string;
      businessType?: string;
      tin?: string;
      address?: string;
      city?: string;
      region?: string;
    },
  ) {
    return this.prisma.merchant.update({
      where: { id: merchantId },
      data: {
        businessName: dto.businessName,
        businessType: dto.businessType,
        tin: dto.tin,
        address: dto.address,
        city: dto.city,
        region: dto.region,
      },
    });
  }
}
