// ============================================================
// Yene Verify — Transaction Projector (13E.1)
//
// Read-optimised projection: one Transaction row per VERIFIED
// verification with source=TRANSACTION. Participates in the
// caller's transaction (the client is passed in) — it must never
// open its own, so finalize() can wrap update + projection in one
// atomic write.
// ============================================================

import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { newId } from '../../common/utils/id.util';
import type { VerdictOutcome } from './verifications.types';

/**
 * A PrismaClient (or TransactionClient) subset the projector needs,
 * so unit tests can pass a narrow mock.
 */
export type ProjectionClient = Pick<
  Prisma.TransactionClient,
  'verification' | 'transaction' | 'subMerchant'
>;

@Injectable()
export class TransactionProjector {
  private readonly logger = new Logger(TransactionProjector.name);

  /**
   * Creates the Transaction row for a completed VERIFIED verification.
   * Idempotent by unique index (verification_id): a race loses and
   * is treated as a no-op.
   */
  async project(
    tx: ProjectionClient,
    verificationId: string,
    outcome: VerdictOutcome,
  ): Promise<void> {
    if (
      outcome.status !== 'VERIFIED' ||
      !outcome.amountMinor ||
      !outcome.bankCode ||
      !outcome.bankReference ||
      !outcome.paidAt
    ) {
      // Never reachable via VerificationsService: projector is only
      // called after a VERIFIED outcome. Guard for future callers.
      return;
    }

    const verification = await tx.verification.findUnique({
      where: { id: verificationId },
      select: {
        id: true,
        merchantId: true,
        verifiedByUserId: true,
        source: true,
        status: true,
      },
    });

    if (!verification || verification.status !== 'VERIFIED') {
      // Verification row is written in the same tx; if it has not
      // reached VERIFIED, projection is not allowed.
      return;
    }

    // Sub-merchant made the call → attach the projection to their branch.
    const actor = await tx.subMerchant.findFirst({
      where: {
        userId: verification.verifiedByUserId,
        merchantId: verification.merchantId,
        deletedAt: null,
      },
      select: { id: true },
    });

    try {
      await tx.transaction.create({
        data: {
          id: newId(),
          merchantId: verification.merchantId,
          verificationId,
          subMerchantId: actor?.id ?? null,
          verifiedByUserId: verification.verifiedByUserId,
          bankCode: outcome.bankCode,
          bankReference: outcome.bankReference,
          amountMinor: outcome.amountMinor,
          senderName: outcome.senderName ?? null,
          receiverName: outcome.receiverName ?? null,
          paidAt: outcome.paidAt,
          status: 'VERIFIED',
          productLabel: null,
          notes: null,
        },
      });
    } catch (err) {
      // Unique violation → another worker already projected this
      // verification. Anything else bubbles up to fail the tx.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        this.logger.log(`Transaction already projected for verification ${verificationId}`);
        return;
      }
      throw err;
    }
  }
}
