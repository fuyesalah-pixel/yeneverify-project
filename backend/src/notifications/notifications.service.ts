// ============================================================
// Yene Verify — Notifications Service (14.3 Part C)
//
// Persistence-only stub for credits notifications: CREDIT_LOW
// (one per merchant per 24h) and CREDIT_EXHAUSTED (no dedup —
// the moment of hitting zero is worth exactly one row).
//
// FCM/push delivery is Step 15; until then these rows ARE the
// merchant's in-app inbox. Every method swallows its own errors
// and logs — callers use these fire-and-forget, and a
// notification failure must never block a submit or a verdict.
// ============================================================

import { Injectable, Logger } from '@nestjs/common';
import type { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Minimum gap between two CREDIT_LOW rows for the same merchant. */
const LOW_BALANCE_DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Low-balance warning (balance > 0 and <= threshold). Deduped:
   * at most one row per merchant per 24h, so a burst of consumes
   * near the threshold does not spam the inbox.
   */
  async notifyLowBalance(merchantId: string, balance: bigint): Promise<void> {
    try {
      const since = new Date(Date.now() - LOW_BALANCE_DEDUP_WINDOW_MS);
      const existing = await this.prisma.notification.findFirst({
        where: { merchantId, type: 'CREDIT_LOW', createdAt: { gte: since } },
        select: { id: true },
      });
      if (existing) {
        this.logger.debug(
          `notification.credit_low.deduped merchantId=${merchantId} existing=${existing.id}`,
        );
        return;
      }
      await this.create(merchantId, 'CREDIT_LOW', {
        title: 'Low credit balance',
        body: `You have ${balance.toString()} verifications left. Top up to keep verifying.`,
        data: { balance: balance.toString() },
      });
    } catch (err) {
      this.logger.error(
        `notification.credit_low.failed merchantId=${merchantId} error=${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Out-of-credits alert at balance === 0. Deliberately NOT deduped:
   * an expiry-then-renewal-then-expiry cycle should re-alert.
   */
  async notifyExhausted(merchantId: string): Promise<void> {
    try {
      await this.create(merchantId, 'CREDIT_EXHAUSTED', {
        title: 'Out of credits',
        body: 'You have 0 verifications remaining. Renew your package to continue.',
        data: { balance: '0' },
      });
    } catch (err) {
      this.logger.error(
        `notification.credit_exhausted.failed merchantId=${merchantId} error=${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /** Resolve the merchant owner (the inbox's user) and insert one row. */
  private async create(
    merchantId: string,
    type: NotificationType,
    payload: { title: string; body: string; data: Record<string, string> },
  ): Promise<void> {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { ownerUserId: true },
    });
    if (!merchant) {
      this.logger.warn(
        `notification.create.skipped merchantId=${merchantId} reason=merchant-not-found`,
      );
      return;
    }

    await this.prisma.notification.create({
      data: {
        id: crypto.randomUUID(),
        userId: merchant.ownerUserId,
        merchantId,
        type,
        title: payload.title,
        body: payload.body,
        channel: 'IN_APP',
        data: payload.data,
      },
    });
    this.logger.log(`notification.created merchantId=${merchantId} type=${type}`);
  }
}
