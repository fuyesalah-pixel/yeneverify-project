// ============================================================
// Yene Verify — NotificationsService Unit Tests (14.3 Part C)
// CREDIT_LOW is deduped per merchant per 24h; CREDIT_EXHAUSTED is
// not. Both resolve the merchant's owner as the inbox user and
// swallow every internal error (fire-and-forget contract).
// ============================================================

import { Logger } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';

jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);

const MERCHANT_ID = '11111111-1111-4111-8111-111111111111';
const OWNER_ID = '22222222-2222-4222-8222-222222222222';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: {
    notification: { findFirst: jest.Mock; create: jest.Mock };
    merchant: { findUnique: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      notification: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
      merchant: {
        findUnique: jest.fn().mockResolvedValue({ ownerUserId: OWNER_ID }),
      },
    };
    service = new NotificationsService(prisma as unknown as PrismaService);
  });

  describe('notifyLowBalance', () => {
    it('creates one IN_APP row addressed to the merchant owner', async () => {
      await service.notifyLowBalance(MERCHANT_ID, 19n);

      expect(prisma.merchant.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: MERCHANT_ID } }),
      );
      const [args] = prisma.notification.create.mock.calls;
      const input = args[0].data;
      expect(input).toMatchObject({
        userId: OWNER_ID,
        merchantId: MERCHANT_ID,
        type: 'CREDIT_LOW',
        channel: 'IN_APP',
        title: 'Low credit balance',
      });
      expect(input.body).toContain('19');
      expect(input.data).toEqual({ balance: '19' });
    });

    it('skips when a CREDIT_LOW row exists within 24h (dedup)', async () => {
      prisma.notification.findFirst.mockResolvedValue({ id: 'recent-row' });

      await service.notifyLowBalance(MERCHANT_ID, 18n);

      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it('looks back exactly 24h for the dedup window', async () => {
      await service.notifyLowBalance(MERCHANT_ID, 20n);

      const since = prisma.notification.findFirst.mock.calls[0][0].where.createdAt.gte;
      const delta = Date.now() - since.getTime();
      // Anywhere in 24h ± 2s of clock skew between the two Date reads.
      expect(delta).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000 - 2000);
      expect(delta).toBeLessThan(24 * 60 * 60 * 1000 + 2000);
    });

    it('is a no-op when the merchant no longer exists', async () => {
      prisma.merchant.findUnique.mockResolvedValue(null);

      await expect(service.notifyLowBalance(MERCHANT_ID, 19n)).resolves.toBeUndefined();
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it('swallows DB failures instead of rejecting (fire-and-forget contract)', async () => {
      prisma.notification.findFirst.mockRejectedValue(new Error('db down'));

      await expect(service.notifyLowBalance(MERCHANT_ID, 19n)).resolves.toBeUndefined();
    });
  });

  describe('notifyExhausted', () => {
    it('creates a row with no dedup lookup', async () => {
      await service.notifyExhausted(MERCHANT_ID);

      expect(prisma.notification.findFirst).not.toHaveBeenCalled();
      const [args] = prisma.notification.create.mock.calls;
      expect(args[0].data).toMatchObject({
        userId: OWNER_ID,
        merchantId: MERCHANT_ID,
        type: 'CREDIT_EXHAUSTED',
        channel: 'IN_APP',
      });
    });

    it('swallows DB failures instead of rejecting', async () => {
      prisma.notification.create.mockRejectedValue(new Error('db down'));

      await expect(service.notifyExhausted(MERCHANT_ID)).resolves.toBeUndefined();
    });
  });
});
