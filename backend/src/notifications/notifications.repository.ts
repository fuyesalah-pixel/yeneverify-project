// ============================================================
// Yene Verify — Notifications Repository (Step 15)
//
// Every Prisma read/write for the inbox + push fan-out lives
// here. The fan-out's device queries live here too (not in the
// auth DeviceRepository) so NotificationsModule keeps a flat
// dependency graph: PrismaModule only.
// ============================================================

import { Injectable } from '@nestjs/common';
import type { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface NotificationRow {
  id: string;
  userId: string;
  merchantId: string | null;
  type: NotificationType;
  title: string;
  body: string;
  data: Prisma.JsonValue | null;
  channel: string;
  readAt: Date | null;
  pushedAt: Date | null;
  pushError: string | null;
  createdAt: Date;
}

export interface NotificationPage {
  rows: NotificationRow[];
  total: number;
}

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ── Row lifecycle ─────────────────────────────────────────────────────
  create(
    data: {
      userId: string;
      merchantId?: string | null;
      type: NotificationType;
      title: string;
      body: string;
      data?: Record<string, unknown>;
    },
    tx?: Prisma.TransactionClient,
  ): Promise<NotificationRow> {
    const client = tx ?? this.prisma;
    return client.notification.create({
      data: {
        id: crypto.randomUUID(),
        userId: data.userId,
        merchantId: data.merchantId ?? null,
        type: data.type,
        title: data.title,
        body: data.body,
        channel: 'PUSH',
        data: (data.data ?? {}) as Prisma.InputJsonValue,
      },
    }) as Promise<NotificationRow>;
  }

  /** Rows survive even if the push never lands — read paths only. */
  findFirst(
    args: { where: Prisma.NotificationWhereInput } & { select?: Prisma.NotificationSelect },
  ): Promise<NotificationRow | null> {
    return this.prisma.notification.findFirst({
      ...args,
      select:
        args.select ??
        ({
          id: true,
          userId: true,
          merchantId: true,
          type: true,
          title: true,
          body: true,
          data: true,
          channel: true,
          readAt: true,
          pushedAt: true,
          pushError: true,
          createdAt: true,
        } satisfies Prisma.NotificationSelect as Prisma.NotificationSelect),
    }) as Promise<NotificationRow | null>;
  }

  // ── Inbox queries ─────────────────────────────────────────────────────
  list(
    userId: string,
    query: {
      page: number;
      pageSize: number;
      unreadOnly: boolean;
      types?: NotificationType[];
    },
  ): Promise<NotificationPage> {
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(query.unreadOnly ? { readAt: null } : {}),
      ...(query.types && query.types.length > 0 ? { type: { in: query.types } } : {}),
    };
    return this.prisma.$transaction(async (tx) => {
      const [rows, total] = await Promise.all([
        tx.notification.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        tx.notification.count({ where }),
      ]);
      return { rows, total } as NotificationPage;
    });
  }

  countUnread(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  /**
   * Ownership-scoped by construction: only the row's own user can
   * clear it. Idempotent — re-marking an already-read row is a no-op
   * (readAt stays the FIRST read time).
   */
  async markRead(userId: string, notificationId: string): Promise<boolean> {
    const result = await this.prisma.notification.updateMany({
      where: { id: notificationId, userId, readAt: null },
      data: { readAt: new Date() },
    });
    return result.count === 1;
  }

  markAllRead(userId: string): Promise<number> {
    return this.prisma.notification
      .updateMany({
        where: { userId, readAt: null },
        data: { readAt: new Date() },
      })
      .then((r) => r.count);
  }

  // ── Push fan-out bookkeeping ──────────────────────────────────────────
  /** Active devices with a usable registration token (Step 8 rows). */
  findPushTargets(userId: string): Promise<{ id: string; pushToken: string | null }[]> {
    return this.prisma.device.findMany({
      where: { userId, revokedAt: null, pushToken: { not: null } },
      select: { id: true, pushToken: true },
      orderBy: { lastSeenAt: 'desc' },
    });
  }

  /** Dead token → the device can never receive again. */
  revokeDevice(deviceId: string): Promise<void> {
    return this.prisma.device
      .update({ where: { id: deviceId }, data: { revokedAt: new Date() } })
      .then(() => undefined);
  }

  markPushed(notificationId: string): Promise<void> {
    return this.prisma.notification
      .update({ where: { id: notificationId }, data: { pushedAt: new Date() } })
      .then(() => undefined);
  }

  markPushError(notificationId: string, error: string): Promise<void> {
    return this.prisma.notification
      .update({ where: { id: notificationId }, data: { pushError: error } })
      .then(() => undefined);
  }
}
