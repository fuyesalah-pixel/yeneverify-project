// ============================================================
// Yene Verify — Receipts Repository
// All Prisma access for Receipt rows lives here so the service stays
// testable against an interface rather than a live client.
// ============================================================

import { Injectable } from '@nestjs/common';
import type { Receipt } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { newId } from '../common/utils/id.util';

export type CreateReceiptInput = {
  merchantId: string;
  uploadedByUserId: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
  sha256: string;
  inputMethod: 'PHOTO' | 'UPLOAD';
  expiresAt: Date | null;
};

@Injectable()
export class ReceiptsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateReceiptInput): Promise<Receipt> {
    return this.prisma.receipt.create({
      data: {
        id: newId(),
        merchantId: input.merchantId,
        uploadedByUserId: input.uploadedByUserId,
        storageKey: input.storageKey,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        width: input.width ?? null,
        height: input.height ?? null,
        sha256: input.sha256,
        inputMethod: input.inputMethod,
        expiresAt: input.expiresAt,
      },
    });
  }

  /** Scoped by merchant — the only lookup that is not admin-scoped. */
  async findByIdForMerchant(id: string, merchantId: string): Promise<Receipt | null> {
    return this.prisma.receipt.findFirst({
      where: { id, merchantId, deletedAt: null },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.receipt.delete({ where: { id } });
  }
}
