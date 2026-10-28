// ============================================================
// Yene Verify — NotificationsService (Step 15)
//
// The SINGLE CHOKE POINT for notification creation. Every code
// path that wants a user to know something writes through
// notify(), which:
//   1. inserts the row (source of truth; the in-app inbox shows
//      it on next poll even if every push fails), then
//   2. fire-and-forget fans the push out to every active device
//      of the target user, updating pushed_at / push_error.
//
// Contracts:
//   - push NEVER throws and NEVER blocks the caller
//   - row-creation failure DOES throw (tx-aware callers rely on
//     it to invalidate the surrounding transaction — its
//     rollback removes the notification with the state change)
//   - a dead token (FcmTokenInvalidError) revokes that device
//     once — FCM says it can never succeed again
//   - a notification counts as pushed when AT LEAST ONE device
//     delivered; the row records either pushedAt or pushError
// ============================================================

import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { NotificationChannel, NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsRepository, type NotificationRow } from './notifications.repository';
import { FcmTokenInvalidError } from './fcm/fcm.errors';
import { FCM_PROVIDER } from './fcm/fcm.provider';
import type { FcmProvider, FcmSendInput } from './fcm/fcm.provider';

/** Minimum gap between two CREDIT_LOW rows for the same merchant. */
const LOW_BALANCE_DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface NotifyInput {
  userId: string;
  merchantId?: string | null;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  /** Override only for deliberately in-app-only rows (default: PUSH). */
  channel?: NotificationChannel;
  /** Participate in the caller's transaction for ROW CREATION only —
   *  the push always runs after creation, fire-and-forget (its
   *  bookkeeping updates simply queue behind the transaction's row
   *  lock and land after commit). */
  tx?: Prisma.TransactionClient;
}

export interface NotifyResult {
  notificationId: string;
  row: NotificationRow;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly repo: NotificationsRepository,
    private readonly prisma: PrismaService,
    @Inject(FCM_PROVIDER) private readonly fcmProvider: FcmProvider,
  ) {}

  // ── Creation ──────────────────────────────────────────────────────────
  async notify(input: NotifyInput): Promise<NotifyResult> {
    const row = await this.repo.create(
      {
        userId: input.userId,
        merchantId: input.merchantId,
        type: input.type,
        title: input.title,
        body: input.body,
        data: input.data,
      },
      input.tx,
    );

    this.logger.log(
      `notification.created userId=${input.userId} merchantId=${input.merchantId ?? '-'} type=${input.type}`,
    );

    if (((input.channel ?? 'PUSH') as NotificationChannel) !== 'PUSH') {
      return { notificationId: row.id, row };
    }

    // Fire-and-forget from creation. Nothing here can delay or fail
    // the caller — every rejection inside is caught and logged.
    void this.pushToUserDevices(row, input.userId).catch((err: unknown) => {
      this.logger.error(
        `notification.fanout.unexpected notificationId=${row.id} error=${err instanceof Error ? err.message : String(err)}`,
      );
    });

    return { notificationId: row.id, row };
  }

  /**
   * Low-balance warning (balance > 0 and <= threshold). Deduped:
   * at most one row per merchant per 24h, so a burst of consumes
   * near the threshold does not spam the inbox.
   */
  async notifyLowBalance(merchantId: string, balance: bigint): Promise<void> {
    try {
      const since = new Date(Date.now() - LOW_BALANCE_DEDUP_WINDOW_MS);
      const existing = await this.repo.findFirst({
        where: { merchantId, type: 'CREDIT_LOW', createdAt: { gte: since } },
        select: { id: true } as Prisma.NotificationSelect,
      });
      if (existing) {
        this.logger.debug(
          `notification.credit_low.deduped merchantId=${merchantId} existing=${existing.id}`,
        );
        return;
      }
      const owner = await this.resolveOwner(merchantId);
      if (!owner) return;
      await this.notify({
        userId: owner,
        merchantId,
        type: 'CREDIT_LOW',
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
      const owner = await this.resolveOwner(merchantId);
      if (!owner) return;
      await this.notify({
        userId: owner,
        merchantId,
        type: 'CREDIT_EXHAUSTED',
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

  // ── In-app inbox queries ─────────────────────────────────────────────
  list(
    userId: string,
    query: {
      page: number;
      pageSize: number;
      unreadOnly: boolean;
      types?: NotificationType[];
    },
  ): Promise<{ rows: NotificationRow[]; total: number }> {
    return this.repo.list(userId, query);
  }

  unreadCount(userId: string): Promise<number> {
    return this.repo.countUnread(userId);
  }

  /** Ownership-scoped: only the recipient may clear their own row. */
  async markRead(userId: string, notificationId: string): Promise<void> {
    const changed = await this.repo.markRead(userId, notificationId);
    if (!changed) {
      throw new NotFoundException(
        `Notification ${notificationId} not found for this user (or already read).`,
      );
    }
  }

  markAllRead(userId: string): Promise<number> {
    return this.repo.markAllRead(userId);
  }

  // ── Push fan-out ─────────────────────────────────────────────────────
  private async pushToUserDevices(row: NotificationRow, userId: string): Promise<void> {
    const devices = await this.repo.findPushTargets(userId);
    if (devices.length === 0) {
      this.logger.log(`notification.no_devices notificationId=${row.id} userId=${userId}`);
      // In-app stays authoritative; nothing to mark.
      return;
    }

    let delivered = 0;
    for (const device of devices) {
      if (!device.pushToken) continue;
      const input: FcmSendInput = {
        token: device.pushToken,
        title: row.title,
        body: row.body,
        data: stringifyData({
          ...(row.data as Record<string, unknown> | null),
          type: row.type,
          notificationId: row.id,
          merchantId: row.merchantId ?? '',
        }),
      };
      try {
        const result = await this.fcmProvider.send(input);
        delivered += 1;
        this.logger.debug(
          `push.delivered notificationId=${row.id} deviceId=${device.id} messageId=${result.messageId}`,
        );
      } catch (err) {
        if (err instanceof FcmTokenInvalidError) {
          // Dead registration token: revoke once, never retry.
          await this.repo.revokeDevice(device.id).catch(() => undefined);
          this.logger.warn(`push.token_revoked notificationId=${row.id} deviceId=${device.id}`);
          continue;
        }
        // Per-device failures are isolated; the rest of the fan-out continues.
        this.logger.warn(
          `push.device_failed notificationId=${row.id} deviceId=${device.id} error=${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    if (delivered > 0) {
      await this.repo.markPushed(row.id).catch(() => undefined);
    } else {
      await this.repo.markPushError(row.id, 'no successful delivery').catch(() => undefined);
    }
  }

  private async resolveOwner(merchantId: string): Promise<string | null> {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { ownerUserId: true },
    });
    if (!merchant) {
      this.logger.warn(
        `notification.create.skipped merchantId=${merchantId} reason=merchant-not-found`,
      );
      return null;
    }
    return merchant.ownerUserId;
  }
}

/** FCM data payloads accept strings only — flatten safely. */
function stringifyData(data: Record<string, unknown> | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(data ?? {})) {
    if (value === null || value === undefined) continue;
    out[key] = typeof value === 'string' ? value : JSON.stringify(value);
  }
  return out;
}
