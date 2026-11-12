// ============================================================
// Yene Verify — Duplicate Detector (13E.1)
//
// Cross-merchant duplicate receipt detection via a deterministic
// fingerprint of (bankCode, referenceNormalized). The fingerprint
// is stored in duplicate_fingerprints on the FIRST verified use;
// later verifications of the same reference are DUPLICATEs.
// ============================================================

import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import type { BankCode } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { newId } from '../../common/utils/id.util';
import type { DuplicateCheck } from './verifications.types';

@Injectable()
export class DuplicateDetector {
  constructor(private readonly prisma: PrismaService) {}

  /** Deterministic: same bank + reference → same fingerprint. */
  computeFingerprint(bankCode: BankCode, referenceNormalized: string): string {
    return createHash('sha256').update(`${bankCode}:${referenceNormalized}`).digest('hex');
  }

  async check(fingerprint: string): Promise<DuplicateCheck | null> {
    const row = await this.prisma.duplicateFingerprint.findUnique({
      where: { fingerprint },
    });
    if (!row) return null;
    return {
      firstVerificationId: row.firstVerificationId,
      firstMerchantId: row.firstMerchantId,
      firstSeenAt: row.firstSeenAt,
      totalHits: row.totalHits,
      blockedAt: row.blockedAt,
    };
  }

  /** First-verified-use registration. Never overwrites an existing row. */
  async record(
    fingerprint: string,
    seed: {
      firstVerificationId: string;
      firstMerchantId: string;
      bankCode: BankCode;
      bankReference: string;
    },
  ): Promise<void> {
    await this.prisma.duplicateFingerprint.create({
      data: {
        id: newId(),
        fingerprint,
        firstVerificationId: seed.firstVerificationId,
        firstMerchantId: seed.firstMerchantId,
        bankCode: seed.bankCode,
        bankReference: seed.bankReference,
        firstSeenAt: new Date(),
        totalHits: 1,
      },
    });
  }

  /** Escalation counter for the admin fraud dashboard. */
  async incrementHits(fingerprint: string): Promise<void> {
    await this.prisma.duplicateFingerprint.update({
      where: { fingerprint },
      data: { totalHits: { increment: 1 } },
    });
  }
}
