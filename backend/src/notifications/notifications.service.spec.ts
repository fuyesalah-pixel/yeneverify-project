// ============================================================
// Yene Verify — NotificationsService Unit Tests (Step 15)
//
// Contracts under test:
//   - notify() is THE single choke point: exactly one repo.write
//   - push fan-out is fire-and-forget and per-device isolated
//   - FcmTokenInvalidError revokes the device (never retried)
//   - pushedAt is set when AT LEAST ONE device delivered; all-fail
//     leaves pushedAt null and sets pushError
//   - CREDIT_LOW dedup (one per merchant per 24h), CREDIT_EXHAUSTED
//     not deduped
//   - inbox queries own the ownership scoping
// ============================================================

import { NotFoundException } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import type { NotificationRow } from './notifications.repository';
import type { FcmProvider, FcmSendInput } from './fcm/fcm.provider';
import { FcmTokenInvalidError, FcmSendError } from './fcm/fcm.errors';

jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);

const USER_ID = '22222222-2222-4222-8222-222222222222';
const MERCHANT_ID = '11111111-1111-4111-8111-111111111111';

let rowSeq = 0;
function makeRow(overrides: Partial<NotificationRow> = {}): NotificationRow {
  rowSeq += 1;
  return {
    id: `notification-${rowSeq}`,
    userId: USER_ID,
    merchantId: MERCHANT_ID,
    type: 'VERIFICATION_RESULT',
    title: 'Payment verified',
    body: 'Reference FT123 verified.',
    data: { verificationId: 'verif-1' },
    channel: 'PUSH',
    readAt: null,
    pushedAt: null,
    pushError: null,
    createdAt: new Date(),
    ...overrides,
  };
}

type RepoMock = {
  create: jest.Mock;
  findFirst: jest.Mock;
  list: jest.Mock;
  countUnread: jest.Mock;
  markRead: jest.Mock;
  markAllRead: jest.Mock;
  findPushTargets: jest.Mock;
  revokeDevice: jest.Mock;
  markPushed: jest.Mock;
  markPushError: jest.Mock;
};

describe('NotificationsService', () => {
  let repo: RepoMock;
  let prisma: { merchant: { findUnique: jest.Mock } };
  let fcm: {
    name: 'mock';
    send: jest.Mock;
    health: jest.Mock;
  };
  let service: NotificationsService;

  beforeEach(() => {
    repo = {
      create: jest.fn(async (_data: unknown, _tx?: unknown) => makeRow()),
      findFirst: jest.fn(async () => null),
      list: jest.fn(async () => ({ rows: [], total: 0 })),
      countUnread: jest.fn(async () => 0),
      markRead: jest.fn(async () => true),
      markAllRead: jest.fn(async () => 0),
      findPushTargets: jest.fn(async () => []),
      revokeDevice: jest.fn(async () => undefined),
      markPushed: jest.fn(async () => undefined),
      markPushError: jest.fn(async () => undefined),
    };
    prisma = {
      merchant: { findUnique: jest.fn(async () => ({ ownerUserId: USER_ID })) },
    };
    fcm = {
      name: 'mock',
      send: jest.fn(async (input: FcmSendInput) => ({
        messageId: `mid-${input.token.slice(0, 4)}`,
      })),
      health: jest.fn(async () => true),
    };
    service = new NotificationsService(
      repo as never,
      prisma as unknown as PrismaService,
      fcm as unknown as FcmProvider,
    );
  });

  describe('notify() — the choke point', () => {
    it('creates exactly one row and fans the push out to every active device', async () => {
      repo.findPushTargets.mockResolvedValue([
        { id: 'device-1', pushToken: 'tok-aaaa1111' },
        { id: 'device-2', pushToken: 'tok-bbbb2222' },
      ]);

      const { notificationId } = await service.notify({
        userId: USER_ID,
        merchantId: MERCHANT_ID,
        type: 'VERIFICATION_RESULT',
        title: 'Payment verified',
        body: 'ok',
      });

      expect(notificationId).toBeDefined();
      expect(repo.create).toHaveBeenCalledTimes(1);
      // fan-out ran (fire-and-forget) — flush it before asserting.
      await Promise.resolve();
      await new Promise((r) => setImmediate(r));
      expect(fcm.send).toHaveBeenCalledTimes(2);
      expect(repo.markPushed).toHaveBeenCalledWith(expect.any(String));
      expect(repo.markPushError).not.toHaveBeenCalled();
    });

    it('passes the caller-supplied transaction through for row creation only', async () => {
      const tx = { $isTx: true };
      await service.notify(
        {
          userId: USER_ID,
          merchantId: MERCHANT_ID,
          type: 'SUB_MERCHANT_JOINED',
          title: 'New team member',
          body: 'x',
          tx: tx as never,
        },
        // tx also as second arg would be a contract bug; input-only is correct
      );
      expect(repo.create).toHaveBeenCalledWith(expect.anything(), tx);
    });

    it('does not push when the row is deliberately in-app-only', async () => {
      await service.notify({
        userId: USER_ID,
        merchantId: MERCHANT_ID,
        type: 'SYSTEM',
        title: 't',
        body: 'b',
        channel: 'IN_APP',
      });
      await new Promise((r) => setImmediate(r));
      expect(repo.findPushTargets).not.toHaveBeenCalled();
      expect(fcm.send).not.toHaveBeenCalled();
    });

    it('row-creation failure still throws (transaction-aware callers rely on the rollback)', async () => {
      repo.create.mockRejectedValue(new Error('db down'));
      await expect(
        service.notify({
          userId: USER_ID,
          merchantId: MERCHANT_ID,
          type: 'SYSTEM',
          title: 't',
          body: 'b',
        }),
      ).rejects.toThrow('db down');
    });
  });

  describe('push fan-out (exercised directly for determinism)', () => {
    async function callWith(row: NotificationRow): Promise<void> {
      await (
        service as unknown as {
          pushToUserDevices(row: NotificationRow, userId: string): Promise<void>;
        }
      ).pushToUserDevices(row, USER_ID);
    }

    it('per-device failure is isolated: device 2 failing does not stop device 1 or 3', async () => {
      repo.create.mockResolvedValue(makeRow());
      const row = await repo.create();
      repo.findPushTargets.mockResolvedValue([
        { id: 'device-1', pushToken: 'tok-good-1' },
        { id: 'device-2', pushToken: 'tok-dead-2' },
        { id: 'device-3', pushToken: 'tok-good-3' },
      ]);
      fcm.send.mockImplementation(async (input: FcmSendInput) => {
        if (input.token === 'tok-dead-2') throw new FcmSendError('boom');
        return { messageId: 'ok' };
      });

      await callWith(row);

      expect(fcm.send).toHaveBeenCalledTimes(3);
      expect(repo.markPushed).toHaveBeenCalledWith(row.id);
      expect(repo.markPushError).not.toHaveBeenCalled();
      expect(repo.revokeDevice).not.toHaveBeenCalled();
    });

    it('all devices failing leaves pushedAt null and sets pushError', async () => {
      repo.create.mockResolvedValue(makeRow());
      const row = await repo.create();
      repo.findPushTargets.mockResolvedValue([{ id: 'device-1', pushToken: 'tok-a' }]);
      fcm.send.mockRejectedValue(new FcmSendError('network down'));

      await callWith(row);

      expect(repo.markPushed).not.toHaveBeenCalled();
      expect(repo.markPushError).toHaveBeenCalledWith(row.id, 'no successful delivery');
    });

    it('an FcmTokenInvalidError revokes the device once and never retries it', async () => {
      repo.create.mockResolvedValue(makeRow());
      const row = await repo.create();
      repo.findPushTargets.mockResolvedValue([{ id: 'device-dead', pushToken: 'tok-dead' }]);
      fcm.send.mockRejectedValue(new FcmTokenInvalidError());

      await callWith(row);

      expect(repo.revokeDevice).toHaveBeenCalledWith('device-dead');
      expect(fcm.send).toHaveBeenCalledTimes(1); // no retry
      expect(repo.markPushed).not.toHaveBeenCalled();
      expect(repo.markPushError).toHaveBeenCalledWith(row.id, 'no successful delivery');
    });

    it('no devices at all → no push, no bookkeeping, no throw (in-app remains authoritative)', async () => {
      repo.create.mockResolvedValue(makeRow());
      const row = await repo.create();
      repo.findPushTargets.mockResolvedValue([]);

      await callWith(row);

      expect(fcm.send).not.toHaveBeenCalled();
      expect(repo.markPushed).not.toHaveBeenCalled();
      expect(repo.markPushError).not.toHaveBeenCalled();
    });

    it('a device row with a null token is skipped without being sent', async () => {
      repo.create.mockResolvedValue(makeRow());
      const row = await repo.create();
      repo.findPushTargets.mockResolvedValue([{ id: 'device-x', pushToken: null }]);

      await callWith(row);

      expect(fcm.send).not.toHaveBeenCalled();
      expect(repo.markPushError).toHaveBeenCalledWith(row.id, 'no successful delivery');
    });

    it('push payload carries type + notificationId + merchantId in the FCM data map (strings only)', async () => {
      repo.create.mockResolvedValue(makeRow({ data: { balance: '19', nested: { a: 1 } } }));
      const row = await repo.create();
      repo.findPushTargets.mockResolvedValue([{ id: 'device-1', pushToken: 'tok' }]);

      await callWith(row);

      const input = fcm.send.mock.calls[0][0] as FcmSendInput;
      expect(input.token).toBe('tok');
      expect(input.title).toBe(row.title);
      expect(input.body).toBe(row.body);
      expect(input.data).toMatchObject({
        balance: '19',
        type: row.type,
        notificationId: row.id,
        merchantId: MERCHANT_ID,
      });
      // JSON-flattened nested value, still a string.
      expect(typeof input.data?.nested).toBe('string');
    });
  });

  describe('notifyLowBalance (dedup) / notifyExhausted (no dedup)', () => {
    it('creates one CREDIT_LOW row when none exists in the last 24h', async () => {
      await service.notifyLowBalance(MERCHANT_ID, 19n);

      expect(repo.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({
          merchantId: MERCHANT_ID,
          type: 'CREDIT_LOW',
          createdAt: { gte: expect.any(Date) },
        }),
        select: { id: true },
      });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_ID,
          merchantId: MERCHANT_ID,
          type: 'CREDIT_LOW',
          title: 'Low credit balance',
        }),
        undefined,
      );
    });

    it('skips creation when a CREDIT_LOW row exists within 24h (dedup)', async () => {
      repo.findFirst.mockResolvedValue({ id: 'recent' });

      await service.notifyLowBalance(MERCHANT_ID, 18n);

      expect(repo.create).not.toHaveBeenCalled();
    });

    it('is a no-op when the merchant no longer exists (fire-and-forget contract)', async () => {
      prisma.merchant.findUnique.mockResolvedValue(null);

      await expect(service.notifyLowBalance(MERCHANT_ID, 19n)).resolves.toBeUndefined();
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('swallows repo failure instead of rejecting (never blocks the caller)', async () => {
      repo.findFirst.mockRejectedValue(new Error('db down'));

      await expect(service.notifyLowBalance(MERCHANT_ID, 19n)).resolves.toBeUndefined();
    });

    it('notifyExhausted creates a row with NO dedup lookup', async () => {
      await service.notifyExhausted(MERCHANT_ID);

      expect(repo.findFirst).not.toHaveBeenCalled();
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_ID,
          merchantId: MERCHANT_ID,
          type: 'CREDIT_EXHAUSTED',
        }),
        undefined,
      );
    });

    it('notifyExhausted swallows repo failure too', async () => {
      repo.create.mockRejectedValue(new Error('db down'));

      await expect(service.notifyExhausted(MERCHANT_ID)).resolves.toBeUndefined();
    });
  });

  describe('inbox queries', () => {
    it('list() is a pass-through to the repository with ownership baked in', async () => {
      repo.list.mockResolvedValue({ rows: [makeRow()], total: 1 });
      const result = await service.list(USER_ID, {
        page: 2,
        pageSize: 10,
        unreadOnly: true,
        types: ['CREDIT_LOW'],
      });

      expect(repo.list).toHaveBeenCalledWith(USER_ID, {
        page: 2,
        pageSize: 10,
        unreadOnly: true,
        types: ['CREDIT_LOW'],
      });
      expect(result.total).toBe(1);
    });

    it('unreadCount() passes the user id through', async () => {
      repo.countUnread.mockResolvedValue(3);
      await expect(service.unreadCount(USER_ID)).resolves.toBe(3);
      expect(repo.countUnread).toHaveBeenCalledWith(USER_ID);
    });

    it('markRead() throws NotFound when nothing changed (foreign or already-read row)', async () => {
      repo.markRead.mockResolvedValue(false);
      await expect(service.markRead(USER_ID, 'row-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('markRead() silently succeeds when the row exists and was unread', async () => {
      repo.markRead.mockResolvedValue(true);
      await expect(service.markRead(USER_ID, 'row-1')).resolves.toBeUndefined();
    });

    it('markAllRead() returns the repository count', async () => {
      repo.markAllRead.mockResolvedValue(5);
      await expect(service.markAllRead(USER_ID)).resolves.toBe(5);
      expect(repo.markAllRead).toHaveBeenCalledWith(USER_ID);
    });
  });
});
