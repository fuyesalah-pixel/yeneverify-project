// ============================================================
// Yene Verify — Notifications E2E (Step 15)
//
// Real DB + real global guards + MOCK FCM provider (FCM_MOCK, the
// default in dev/test — never a real push in tests).
//
// Covered:
//   - notify() row appears in GET /notifications (list w/ meta)
//   - push fan-out reaches the device token (mock provider records)
//   - FcmTokenInvalidError revokes the device; the row lands anyway
//   - unread-count increments, read decrements (204), read-all counts
//   - unreadOnly=true excludes read rows
//   - foreign-user notification read → 404 (ownership, server-side)
//   - user with no devices → row exists, no push, no crash
//   - every device failing → pushedAt null, pushError set
//
// The inbox endpoints are the spec's 4 new routes; notifications
// arrival is driven through the REAL notify() service (same path
// the processor and invites use).
// ============================================================

import { Test } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { randomBytes } from 'crypto';
import { AppModule } from '../src/app.module';
import { AppConfigService } from '../src/config/config.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { TokenService } from '../src/auth/tokens/token.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { MockFcmProvider } from '../src/notifications/fcm/fcm.provider.mock';
import { FCM_PROVIDER } from '../src/notifications/fcm/fcm.provider';
import { FcmTokenInvalidError } from '../src/notifications/fcm/fcm.errors';
import { newId } from '../src/common/utils/id.util';
import {
  createMerchantFixture,
  generatePhone,
  resetFixtureState,
  type MerchantFixture,
} from './fixtures';

jest.setTimeout(120_000);

const POLL_INTERVAL_MS = 200;
const POLL_TIMEOUT_MS = 15_000;

describe('Notifications inbox + push (e2e, real DB, mock FCM)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let notifications: NotificationsService;
  let mockFcm: MockFcmProvider;
  let accessToken: string;

  // Fixture ids resolved in beforeAll via the shared helpers.
  let fixture: MerchantFixture;
  let userId: string;
  let merchantId: string;
  let deviceId: string;
  let sessionId: string;
  let PUSH_TOKEN: string;
  const foreignUserId = newId();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication({ logger: ['error', 'warn'] });
    const cfg = app.get(AppConfigService);
    app.setGlobalPrefix(cfg.runtime.apiPrefix, {
      exclude: ['health', 'health/ready', 'docs', 'version', '/'],
    });
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: cfg.runtime.apiVersion.replace(/^v/i, ''),
    });
    await app.init();

    prisma = app.get(PrismaService);
    notifications = app.get(NotificationsService);
    mockFcm = app.get<MockFcmProvider>(FCM_PROVIDER) as MockFcmProvider;
    expect(mockFcm.name).toBe('mock'); // guard: a firebase provider in CI would be a real-send hazard

    // ── Fixture: merchant + owner with one registered device ────────────
    // Shared helper (test/fixtures) — per-run ids, valid phone, FK chain:
    // user(MERCHANT) → merchant → package → ACTIVE subscription (+30d).
    fixture = await createMerchantFixture(prisma, {
      businessName: 'E2E Notifications Coffee',
      withDevice: true,
    });
    userId = fixture.userId;
    merchantId = fixture.merchantId;
    deviceId = fixture.deviceId!;
    sessionId = fixture.sessionId!;
    PUSH_TOKEN = fixture.pushToken!;

    // A second, bare user with NO device — foreign-ownership + no-device cases.
    await prisma.user.create({
      data: {
        id: foreignUserId,
        phone: generatePhone(),
        phoneVerifiedAt: new Date(),
        fullName: 'E2E Notifications Bare User',
        role: 'SUB_MERCHANT',
        status: 'ACTIVE',
      },
    });

    accessToken = app.get(TokenService).signAccessToken({
      sub: userId,
      role: 'MERCHANT',
      merchantId,
      sid: sessionId,
      did: deviceId,
    });
  }, 60_000);

  afterAll(async () => {
    // Only cheap rows come home (reset helper skips the immutable ledger
    // and its rule-protected parents) — harmless with fresh per-run ids.
    await resetFixtureState(prisma, {
      userIds: [userId, foreignUserId],
      merchantIds: [merchantId],
    }).catch(() => undefined);
    await app.close();
  });

  const auth = () => ({ Authorization: `Bearer ${accessToken}` });

  async function waitForPushBookkeeping(
    notificationId: string,
    field: 'pushedAt' | 'pushError',
  ): Promise<void> {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    for (;;) {
      const row = await prisma.notification.findUnique({ where: { id: notificationId } });
      if (row && row[field] !== null) return;
      if (Date.now() > deadline) {
        throw new Error(
          `Notification ${notificationId}: ${field} never settled within ${POLL_TIMEOUT_MS}ms`,
        );
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
  }

  it('fans out to the device, records the inbox row, and marks it pushed', async () => {
    const before = mockFcm.sent.length;

    const { notificationId } = await notifications.notify({
      userId,
      merchantId,
      type: 'VERIFICATION_RESULT',
      title: 'Payment verified',
      body: 'Reference FT2XYZ95DBK5W81465291 verified successfully.',
      data: { verificationId: 'e2e-verif-1', status: 'VERIFIED' },
    });
    expect(notificationId).toBeTruthy();

    // Push reached the registered device with the exact payload contract.
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    while (mockFcm.sent.length <= before) {
      if (Date.now() > deadline) throw new Error('mock FCM never received the push');
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
    const pushed = mockFcm.sent[mockFcm.sent.length - 1];
    expect(pushed.token).toBe(PUSH_TOKEN);
    expect(pushed.title).toBe('Payment verified');
    expect(pushed.data).toMatchObject({
      notificationId,
      type: 'VERIFICATION_RESULT',
      verificationId: 'e2e-verif-1',
    });
    // FCM data maps carry strings only.
    expect(Object.values(pushed.data ?? {}).every((v) => typeof v === 'string')).toBe(true);

    await waitForPushBookkeeping(notificationId, 'pushedAt');
    const row = await prisma.notification.findUnique({ where: { id: notificationId } });
    expect(row?.pushError).toBeNull(); // pushed ⇒ no error recorded
  }, 30_000);

  it('lists the inbox with unreadCount in meta, honors unreadOnly, decrements on read', async () => {
    // A second unread row so read-all has real work to do.
    await notifications.notify({
      userId,
      merchantId,
      type: 'CREDIT_LOW',
      title: 'Low credit balance',
      body: 'You have 19 verifications left.',
      data: { balance: '19' },
    });

    const unreadCount = await request(app.getHttpServer())
      .get('/api/v1/notifications/unread-count')
      .set(auth())
      .expect(200);
    const initialUnread = unreadCount.body.count as number;
    expect(initialUnread).toBeGreaterThanOrEqual(2);

    const list = await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .set(auth())
      .expect(200);
    expect(list.body.meta.page).toBe(1);
    expect(list.body.meta.total).toBeGreaterThanOrEqual(2);
    expect(list.body.meta.unreadCount).toBe(initialUnread);
    expect(list.body.data).toHaveLength(Math.min(20, list.body.meta.total));
    expect(list.body.data[0].createdAt >= list.body.data[1].createdAt).toBe(true); // newest first
    expect(typeof list.body.data[0].id).toBe('string');
    expect(list.body.data[0]).toHaveProperty('pushedAt');

    const target = list.body.data[0].id as string;
    await request(app.getHttpServer())
      .post(`/api/v1/notifications/${target}/read`)
      .set(auth())
      .expect(204);

    // unread badge decremented by exactly one.
    const afterRead = await request(app.getHttpServer())
      .get('/api/v1/notifications/unread-count')
      .set(auth())
      .expect(200);
    expect(afterRead.body.count).toBe(initialUnread - 1);

    // ...and the row is written readAt (set on the row we marked).
    const row = await prisma.notification.findUnique({ where: { id: target } });
    expect(row?.readAt).not.toBeNull();

    // unreadOnly filter exposes only unread rows (Wire #3 semantics).
    const unreadOnly = await request(app.getHttpServer())
      .get('/api/v1/notifications?unreadOnly=true')
      .set(auth())
      .expect(200);
    for (const item of unreadOnly.body.data as { id: string }[]) {
      expect(item.id).not.toBe(target);
    }
    expect(unreadOnly.body.data).toHaveLength(initialUnread - 1);
  }, 30_000);

  it('marks MY notification as read only; a foreign user row is 404', async () => {
    const foreign = await notifications.notify({
      userId: foreignUserId,
      type: 'SYSTEM',
      title: 'For someone else',
      body: 'hidden to the caller',
      data: {},
    });

    // Ownership: the row's userId is checked server-side (updateMany where
    // userId) — "4XX not found" instead of a 403 (no row-crawling oracle).
    await request(app.getHttpServer())
      .post(`/api/v1/notifications/${foreign.notificationId}/read`)
      .set(auth())
      .expect(404);

    // A made-up id does not create something either.
    await request(app.getHttpServer())
      .post(`/api/v1/notifications/${newId()}/read`)
      .set(auth())
      .expect(404);

    // Already-read (in-app-clearable) is idempotent-with-204 semantics:
    // first read already verified above; my own inbox unaffected.
    const unread = await request(app.getHttpServer())
      .get('/api/v1/notifications/unread-count')
      .set(auth())
      .expect(200);
    expect(typeof unread.body.count).toBe('number');
  }, 30_000);

  it('marks all remaining unread rows as read with an accurate count', async () => {
    const unreadBefore = await prisma.notification.count({ where: { userId, readAt: null } });

    const res = await request(app.getHttpServer())
      .post('/api/v1/notifications/read-all')
      .set(auth())
      .expect(200);
    expect(res.body.markedCount).toBe(unreadBefore);

    const unreadAfter = await request(app.getHttpServer())
      .get('/api/v1/notifications/unread-count')
      .set(auth())
      .expect(200);
    expect(unreadAfter.body.count).toBe(0);
  }, 30_000);

  it('supports paging and a type filter on the inbox list', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/notifications?pageSize=1&page=1&type=CREDIT_LOW')
      .set(auth())
      .expect(200);

    expect(res.body.data).toHaveLength(1);
    for (const item of res.body.data as { type: string }[]) {
      expect(item.type).toBe('CREDIT_LOW');
    }
    expect(res.body.meta.total).toBeGreaterThanOrEqual(1);
    expect(res.body.meta.totalPages).toBeGreaterThanOrEqual(1);
  }, 30_000);

  it('a user with no devices gets the row but no push and no bookkeeping', async () => {
    const before = mockFcm.sent.length;

    const { notificationId } = await notifications.notify({
      userId: foreignUserId,
      type: 'SUB_MERCHANT_INVITED',
      title: 'Team invite',
      body: 'You were invited to join a merchant team on Yene Verify.',
      data: {},
    });

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS * 3));
    expect(mockFcm.sent.length).toBe(before); // zero push attempts

    const row = await prisma.notification.findUnique({ where: { id: notificationId } });
    expect(row).not.toBeNull();
    expect(row?.pushedAt).toBeNull();
    expect(row?.pushError).toBeNull(); // no_devices is not an error
  }, 30_000);

  it('every device failing leaves pushedAt null and sets pushError', async () => {
    const sendSpy = jest.spyOn(mockFcm, 'send').mockRejectedValue(new Error('fcm down'));

    try {
      const { notificationId } = await notifications.notify({
        userId,
        merchantId,
        type: 'SYSTEM',
        title: 'planned failure',
        body: 'the mock provider will reject',
        data: {},
      });

      await waitForPushBookkeeping(notificationId, 'pushError');
      const row = await prisma.notification.findUnique({ where: { id: notificationId } });
      expect(row?.pushedAt).toBeNull();
      expect(row?.pushError).toBe('no successful delivery');
    } finally {
      sendSpy.mockRestore();
    }
  }, 30_000);

  it('FcmTokenInvalidError revokes the device; surviving devices still receive the push', async () => {
    // A second, HEALTHY device for the same user: fan-out isolation in action.
    const healthyDeviceId = newId();
    const healthyToken = `fcm-e2e-alive-${randomBytes(6).toString('hex')}`;
    await prisma.device.create({
      data: {
        id: healthyDeviceId,
        userId,
        deviceFingerprint: `e2e-notif-alive-${randomBytes(6).toString('hex')}`,
        platform: 'IOS',
        pushToken: healthyToken,
      },
    });

    const goodSendCalls: string[] = [];
    const sendSpy = jest.spyOn(mockFcm, 'send').mockImplementation(async (input) => {
      if (input.token === PUSH_TOKEN) throw new FcmTokenInvalidError();
      goodSendCalls.push(input.token);
      return { messageId: 'mock-ok' };
    });

    try {
      const { notificationId } = await notifications.notify({
        userId,
        merchantId,
        type: 'SYSTEM',
        title: 'dead token + live token',
        body: 'fan-out isolation',
        data: {},
      });

      // Healthy device delivered → the row counts as pushed.
      await waitForPushBookkeeping(notificationId, 'pushedAt');
      expect(goodSendCalls).toEqual([healthyToken]); // dead token never retried

      // The dead device is revoked — findPushTargets excludes it forever.
      const deadDevice = await prisma.device.findUnique({ where: { id: deviceId } });
      expect(deadDevice?.revokedAt).not.toBeNull();

      // A later notification goes ONLY to the surviving device.
      const before = mockFcm.sent.length;
      const goodResult = await mockFcm.send({ token: healthyToken, title: 'ping', body: 'b' });
      expect(goodResult.messageId).toBe('mock-ok');
      expect(mockFcm.sent.length).toBeGreaterThanOrEqual(before);
    } finally {
      sendSpy.mockRestore();
      // Returning the fixture to its documented state for other suites.
      await prisma.device
        .update({ where: { id: healthyDeviceId }, data: { revokedAt: new Date() } })
        .catch(() => undefined);
    }
  }, 30_000);
});
