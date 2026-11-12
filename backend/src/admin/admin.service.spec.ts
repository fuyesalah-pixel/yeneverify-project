// ============================================================
// Yene Verify — Admin Service Unit Tests
// Stubbed verifyIdToken; mocked prisma/redis/token/session/audit.
// ============================================================

import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AdminService } from './admin.service';

const WEB_CLIENT_ID =
  '1042108670897-mvf53pl5jnrqpe7kco0cl75bbgm9vfuh.apps.googleusercontent.com';

const configMock: any = {
  adminEmails: ['Fuad@Example.com', 'fuyesalah@gmail.com'],
  jwt: { accessTtl: '15m' },
  googleWebClientId: WEB_CLIENT_ID,
};

const prismaMock: any = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  device: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  merchant: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    aggregate: jest.fn(),
  },
  session: { count: jest.fn(), updateMany: jest.fn() },
  subscription: { findFirst: jest.fn() },
  transaction: { findMany: jest.fn() },
  verification: { groupBy: jest.fn(), findMany: jest.fn() },
  creditTransaction: { aggregate: jest.fn(), groupBy: jest.fn(), findMany: jest.fn() },
  auditLog: { findMany: jest.fn() },
  package: { findMany: jest.fn() },
  $queryRaw: jest.fn(),
  // Supports both the array form and the interactive-callback form.
  $transaction: jest.fn((arg: any) =>
    typeof arg === 'function' ? arg(prismaMock) : Promise.all(arg),
  ),
};

const tokenServiceMock: any = { signAccessToken: jest.fn().mockReturnValue('access-token') };
const sessionServiceMock: any = {
  createSession: jest
    .fn()
    .mockResolvedValue({ sessionId: 'sess-1', rawRefreshToken: 'refresh-token' }),
};
const redisMock: any = {
  incr: jest.fn().mockResolvedValue(1),
  raw: { ping: jest.fn().mockResolvedValue('PONG') },
};
const auditMock: any = { log: jest.fn() };
const creditsMock: any = { adjust: jest.fn(), getBalance: jest.fn() };
const firebaseAdminMock: any = {};

function buildService(): AdminService {
  return new AdminService(
    configMock,
    prismaMock,
    tokenServiceMock,
    sessionServiceMock,
    auditMock,
    redisMock,
    creditsMock,
    firebaseAdminMock,
  );
}

const activeUser = {
  id: 'user-admin',
  phone: '+251900000001',
  fullName: 'Fuad',
  role: 'ADMIN',
  status: 'ACTIVE',
  googleUid: 'google-uid-1',
  googleEmail: 'fuad@example.com',
  googleLinkedAt: new Date('2026-01-01'),
  lastLoginAt: null,
};

describe('AdminService', () => {
  let service: AdminService;

  beforeEach(() => {
    jest.clearAllMocks();
    redisMock.incr.mockResolvedValue(1);
    redisMock.raw.ping.mockResolvedValue('PONG');
    service = buildService();
  });

  describe('googleLogin()', () => {
    it('issues admin tokens for an allowlisted email', async () => {
      (service as any).verifyIdToken = jest.fn().mockResolvedValue({
        sub: 'google-uid-1',
        email: 'fuad@example.com',
        email_verified: true,
        name: 'Fuad',
      });
      prismaMock.user.findUnique.mockResolvedValue(activeUser);
      prismaMock.user.update.mockResolvedValue(activeUser);
      prismaMock.device.findFirst.mockResolvedValue({ id: 'dev-1' });
      prismaMock.device.update.mockResolvedValue({ id: 'dev-1' });

      const result = await service.googleLogin({ idToken: 'tok', ip: '1.2.3.4' });

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 900,
        user: {
          id: 'user-admin',
          email: 'fuad@example.com',
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      });
      expect(redisMock.incr).toHaveBeenCalledWith('admin-auth:ip:1.2.3.4', 3600);
      expect(prismaMock.device.findFirst).toHaveBeenCalledWith({
        where: { userId: 'user-admin', deviceFingerprint: 'admin-web:1.2.3.4' },
      });
      expect(sessionServiceMock.createSession).toHaveBeenCalledWith(
        'user-admin',
        'dev-1',
        '1.2.3.4',
        undefined,
      );
      expect(tokenServiceMock.signAccessToken).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 'user-admin', role: 'ADMIN', sid: 'sess-1', did: 'dev-1' }),
      );
    });

    it('matches the allowlist case-insensitively', async () => {
      (service as any).verifyIdToken = jest.fn().mockResolvedValue({
        sub: 'google-uid-1',
        email: 'FUAD@example.com',
        email_verified: true,
      });
      prismaMock.user.findUnique.mockResolvedValue(activeUser);
      prismaMock.user.update.mockResolvedValue(activeUser);
      prismaMock.device.findFirst.mockResolvedValue({ id: 'dev-1' });
      prismaMock.device.update.mockResolvedValue({ id: 'dev-1' });

      await expect(service.googleLogin({ idToken: 'tok' })).resolves.toMatchObject({
        accessToken: 'access-token',
      });
    });

    it('rejects an email that is not allowlisted', async () => {
      (service as any).verifyIdToken = jest.fn().mockResolvedValue({
        sub: 'google-uid-9',
        email: 'intruder@example.com',
        email_verified: true,
      });

      await expect(service.googleLogin({ idToken: 'tok', ip: '9.9.9.9' })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'auth.admin.google.login.rejected' }),
      );
    });

    it('rejects an unverified Google email', async () => {
      (service as any).verifyIdToken = jest.fn().mockResolvedValue({
        sub: 'google-uid-1',
        email: 'fuad@example.com',
        email_verified: false,
      });

      await expect(service.googleLogin({ idToken: 'tok' })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects an invalid Google ID token', async () => {
      (service as any).verifyIdToken = jest.fn().mockRejectedValue(new Error('invalid'));

      await expect(service.googleLogin({ idToken: 'tok' })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('creates the admin user on first sign-in', async () => {
      (service as any).verifyIdToken = jest.fn().mockResolvedValue({
        sub: 'google-uid-2',
        email: 'fuyesalah@gmail.com',
        email_verified: true,
      });
      prismaMock.user.findUnique
        .mockResolvedValueOnce(null) // by googleUid
        .mockResolvedValueOnce(null); // by placeholder phone
      prismaMock.user.findFirst.mockResolvedValue(null); // by googleEmail
      prismaMock.user.create.mockResolvedValue({
        ...activeUser,
        id: 'user-new',
        phone: '+251900000002',
        googleEmail: 'fuyesalah@gmail.com',
      });
      prismaMock.device.findFirst.mockResolvedValue(null);
      prismaMock.device.create.mockResolvedValue({ id: 'dev-new' });

      const result = await service.googleLogin({ idToken: 'tok', ip: '1.1.1.1' });

      expect(prismaMock.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            phone: '+251900000002',
            role: 'ADMIN',
            googleEmail: 'fuyesalah@gmail.com',
            googleUid: 'google-uid-2',
          }),
        }),
      );
      expect(result.user.id).toBe('user-new');
      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'auth.admin.google.login.created' }),
      );
    });

    it('rejects an allowlisted email whose account is not ADMIN', async () => {
      (service as any).verifyIdToken = jest.fn().mockResolvedValue({
        sub: 'google-uid-3',
        email: 'fuad@example.com',
        email_verified: true,
      });
      prismaMock.user.findUnique.mockResolvedValue({ ...activeUser, role: 'MERCHANT' });

      await expect(service.googleLogin({ idToken: 'tok' })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'auth.admin.google.login.invalid_role' }),
      );
    });

    it('rejects a banned admin account', async () => {
      (service as any).verifyIdToken = jest.fn().mockResolvedValue({
        sub: 'google-uid-1',
        email: 'fuad@example.com',
        email_verified: true,
      });
      prismaMock.user.findUnique.mockResolvedValue({ ...activeUser, status: 'BANNED' });

      await expect(service.googleLogin({ idToken: 'tok' })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rate limits after 10 attempts from one IP', async () => {
      redisMock.incr.mockResolvedValue(11);
      const spy = jest.fn();
      (service as any).verifyIdToken = spy;

      await expect(service.googleLogin({ idToken: 'tok', ip: '2.2.2.2' })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('verifyIdToken()', () => {
    it('falls back to Google OAuth verification for Identity Services tokens', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            aud: WEB_CLIENT_ID,
            sub: 'google-uid-1',
            email: 'fuad@example.com',
            email_verified: 'true',
            iss: 'https://accounts.google.com',
            exp: String(Math.floor(Date.now() / 1000) + 3600),
          }),
      });
      const originalFetch = global.fetch;
      global.fetch = fetchMock as unknown as typeof fetch;

      try {
        const identity = await (service as any).verifyIdToken('gis-token');
        expect(identity).toEqual({
          sub: 'google-uid-1',
          email: 'fuad@example.com',
          email_verified: true,
          name: undefined,
        });
        expect(fetchMock).toHaveBeenCalledWith(
          `https://oauth2.googleapis.com/tokeninfo?id_token=gis-token`,
        );
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('rejects a Google token minted for another client ID', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            aud: 'someone-else.apps.googleusercontent.com',
            sub: 'google-uid-2',
            email: 'intruder@example.com',
            email_verified: 'true',
            iss: 'https://accounts.google.com',
            exp: String(Math.floor(Date.now() / 1000) + 3600),
          }),
      });
      const originalFetch = global.fetch;
      global.fetch = fetchMock as unknown as typeof fetch;

      try {
        await expect((service as any).verifyIdToken('other-token')).rejects.toBeTruthy();
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('rejects an expired Google token', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            aud: WEB_CLIENT_ID,
            sub: 'google-uid-1',
            email: 'fuad@example.com',
            email_verified: 'true',
            iss: 'https://accounts.google.com',
            exp: String(Math.floor(Date.now() / 1000) - 60),
          }),
      }) as unknown as typeof fetch;

      await expect((service as any).verifyIdToken('expired-token')).rejects.toBeTruthy();
    });
  });

  describe('getHealth()', () => {
    it('reports ok when every dependency is up', async () => {
      prismaMock.$queryRaw.mockResolvedValue([{ '1': 1 }]);

      const result = await service.getHealth();

      expect(result.status).toBe('ok');
      expect(result.checks).toEqual({ database: true, redis: true, firebase: true });
    });

    it('reports degraded when a dependency is down', async () => {
      prismaMock.$queryRaw.mockRejectedValue(new Error('db down'));

      const result = await service.getHealth();

      expect(result.status).toBe('degraded');
      expect(result.checks.database).toBe(false);
    });
  });

  describe('getUsers()', () => {
    const row = {
      id: 'user-1',
      fullName: 'Selam Coffee',
      phone: '+251911000111',
      googleEmail: 'selam@example.com',
      googleLinkedAt: null,
      role: 'MERCHANT',
      status: 'ACTIVE',
      lastLoginAt: null,
      createdAt: new Date('2026-02-01'),
      pinSetAt: null,
      ownedMerchant: {
        id: 'merchant-1',
        businessName: 'Selam Coffee',
        status: 'ACTIVE',
        creditsBalance: 500n,
        currentPackageCode: 'PREMIUM',
      },
      subMerchantProfile: null,
      _count: { sessions: 2 },
    };

    it('defaults to merchant accounts and serializes BigInt credits', async () => {
      prismaMock.user.findMany.mockResolvedValue([row]);
      prismaMock.user.count.mockResolvedValue(1);

      const result = await service.getUsers({});

      expect(prismaMock.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { role: { in: ['MERCHANT', 'SUB_MERCHANT'] } },
          skip: 0,
          take: 20,
        }),
      );
      expect(result.users[0]).toMatchObject({
        id: 'user-1',
        creditsBalance: '500',
        packageCode: 'PREMIUM',
        merchant: {
          id: 'merchant-1',
          businessName: 'Selam Coffee',
          relation: 'OWNER',
        },
        sessionCount: 2,
      });
      expect(result.totalPages).toBe(1);
    });

    it('applies role, status and search filters', async () => {
      prismaMock.user.findMany.mockResolvedValue([]);
      prismaMock.user.count.mockResolvedValue(0);

      await service.getUsers({
        page: 2,
        pageSize: 50,
        role: 'SUB_MERCHANT',
        status: 'SUSPENDED',
        search: 'selam',
      });

      expect(prismaMock.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 50,
          take: 50,
          where: expect.objectContaining({
            role: 'SUB_MERCHANT',
            status: 'SUSPENDED',
            OR: [
              { fullName: { contains: 'selam', mode: 'insensitive' } },
              { phone: { contains: 'selam' } },
              { googleEmail: { contains: 'selam', mode: 'insensitive' } },
              { ownedMerchant: { businessName: { contains: 'selam', mode: 'insensitive' } } },
            ],
          }),
        }),
      );
    });

    it('clamps page size to 100 and page to at least 1', async () => {
      prismaMock.user.findMany.mockResolvedValue([]);
      prismaMock.user.count.mockResolvedValue(0);

      await service.getUsers({ page: 0, pageSize: 500 });

      expect(prismaMock.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 100 }),
      );
    });

    it('filters by package on the owned merchant', async () => {
      prismaMock.user.findMany.mockResolvedValue([]);
      prismaMock.user.count.mockResolvedValue(0);

      await service.getUsers({ package: 'BUSINESS' as any });

      expect(prismaMock.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            ownedMerchant: { currentPackageCode: 'BUSINESS' },
          }),
        }),
      );
    });
  });

  describe('getUserDetail()', () => {
    it('serializes BigInt credit figures and 404s an unknown user', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-1',
        fullName: 'Selam Coffee',
        phone: '+251911000111',
        phoneVerifiedAt: null,
        role: 'MERCHANT',
        status: 'ACTIVE',
        preferredLanguage: 'en',
        createdAt: new Date('2026-02-01'),
        updatedAt: new Date('2026-02-02'),
        deletedAt: null,
        lastLoginAt: null,
        pinSetAt: null,
        pinFailedAttempts: 0,
        pinLockedUntil: null,
        biometricEnabled: false,
        googleEmail: null,
        googleLinkedAt: null,
        phonePairedAt: null,
        ownedMerchant: {
          id: 'merchant-1',
          businessName: 'Selam Coffee',
          businessType: 'Cafe',
          tin: null,
          address: null,
          city: 'Addis Ababa',
          region: null,
          status: 'ACTIVE',
          creditsBalance: 42n,
          creditsUpdatedAt: null,
          currentPackageCode: 'PREMIUM',
          createdAt: new Date('2026-02-01'),
        },
        subMerchantProfile: null,
        devices: [],
      });
      prismaMock.subscription.findFirst.mockResolvedValue(null);
      prismaMock.creditTransaction.aggregate.mockResolvedValue({ _sum: { amount: 42n } });
      prismaMock.creditTransaction.groupBy.mockResolvedValue([
        { type: 'GRANT', _sum: { amount: 100n }, _count: { _all: 2 } },
        { type: 'CONSUME', _sum: { amount: -58n }, _count: { _all: 58 } },
      ]);
      prismaMock.verification.groupBy.mockResolvedValue([
        { status: 'VERIFIED', _count: { _all: 40 } },
        { status: 'FAKE', _count: { _all: 2 } },
      ]);
      prismaMock.transaction.findMany.mockResolvedValue([]);
      prismaMock.creditTransaction.findMany.mockResolvedValue([]);
      prismaMock.verification.findMany.mockResolvedValue([]);
      prismaMock.auditLog.findMany.mockResolvedValue([]);
      prismaMock.session.count.mockResolvedValue(1);

      const result = await service.getUserDetail('user-1');

      expect(result.merchant?.creditsBalance).toBe('42');
      expect(result.credits).toEqual({
        merchantId: 'merchant-1',
        ledgerBalance: '42',
        lifetimeGranted: '100',
        lifetimeConsumed: '58',
        lifetimeRefunded: '0',
        lifetimeExpired: '0',
      });
      expect(result.activity.totalVerifications).toBe(42);
      expect(result.activity.verifications).toEqual({ VERIFIED: 40, FAKE: 2 });

      prismaMock.user.findUnique.mockResolvedValue(null);
      await expect(service.getUserDetail('missing')).rejects.toThrow('User not found.');
    });
  });

  describe('setUserStatus()', () => {
    const target = {
      id: 'user-1',
      role: 'MERCHANT',
      status: 'ACTIVE',
      ownedMerchant: { id: 'merchant-1', status: 'ACTIVE' },
    };

    it('suspends the user and their merchant, then revokes live sessions', async () => {
      prismaMock.user.findUnique.mockResolvedValue(target);
      prismaMock.user.update.mockResolvedValue({ ...target, status: 'SUSPENDED' });
      prismaMock.merchant.update.mockResolvedValue({ id: 'merchant-1', status: 'SUSPENDED' });
      prismaMock.session.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.setUserStatus({
        userId: 'user-1',
        action: 'SUSPEND',
        reason: 'chargeback abuse',
        actorUserId: 'admin-1',
      });

      expect(result).toEqual({ changed: true, status: 'SUSPENDED', merchantStatus: 'SUSPENDED' });
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { status: 'SUSPENDED', deletedAt: undefined },
      });
      expect(prismaMock.merchant.update).toHaveBeenCalledWith({
        where: { id: 'merchant-1' },
        data: { status: 'SUSPENDED' },
      });
      expect(prismaMock.session.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'admin.user.suspend',
          metadata: expect.objectContaining({ reason: 'chargeback abuse' }),
        }),
      );
    });

    it('restores the merchant when reactivating', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        ...target,
        status: 'SUSPENDED',
        ownedMerchant: { id: 'merchant-1', status: 'SUSPENDED' },
      });
      prismaMock.user.update.mockResolvedValue({ ...target, status: 'ACTIVE' });
      prismaMock.merchant.update.mockResolvedValue({ id: 'merchant-1', status: 'ACTIVE' });

      const result = await service.setUserStatus({
        userId: 'user-1',
        action: 'REACTIVATE',
        actorUserId: 'admin-1',
      });

      expect(result.status).toBe('ACTIVE');
      // Reactivation must not revoke sessions that no longer exist anyway.
      expect(prismaMock.session.updateMany).not.toHaveBeenCalled();
    });

    it('is a no-op when the status already matches', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ ...target, status: 'BANNED' });

      const result = await service.setUserStatus({
        userId: 'user-1',
        action: 'BAN',
        actorUserId: 'admin-1',
      });

      expect(result.changed).toBe(false);
      expect(prismaMock.user.update).not.toHaveBeenCalled();
      expect(auditMock.log).not.toHaveBeenCalled();
    });

    it('refuses to change an admin account', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ ...target, role: 'ADMIN' });

      await expect(
        service.setUserStatus({ userId: 'user-1', action: 'BAN', actorUserId: 'admin-1' }),
      ).rejects.toThrow('Admin accounts cannot be suspended');
    });

    it('404s an unknown user', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(
        service.setUserStatus({ userId: 'nope', action: 'BAN', actorUserId: 'admin-1' }),
      ).rejects.toThrow('User not found.');
    });
  });

  describe('resetUserPin()', () => {
    it('clears the PIN and revokes every session', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: 'MERCHANT',
        pinSetAt: new Date('2026-03-01'),
      });
      prismaMock.user.update.mockResolvedValue({ id: 'user-1', pinSetAt: null });
      prismaMock.session.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.resetUserPin({ userId: 'user-1', actorUserId: 'admin-1' });

      expect(result).toEqual({ pinSet: false, sessionsRevoked: 2 });
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          pinHash: null,
          pinSetAt: null,
          pinFailedAttempts: 0,
          pinLockedUntil: null,
        },
        select: { id: true, pinSetAt: true },
      });
      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'admin.user.pin_reset' }),
      );
    });
  });

  describe('revokeUserDevice()', () => {
    it('revokes the device and its sessions', async () => {
      prismaMock.device.findFirst.mockResolvedValue({
        id: 'dev-1',
        model: 'Pixel 7',
        platform: 'ANDROID',
        revokedAt: null,
      });
      prismaMock.device.update.mockResolvedValue({ id: 'dev-1', revokedAt: new Date() });
      prismaMock.session.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.revokeUserDevice({
        userId: 'user-1',
        deviceId: 'dev-1',
        actorUserId: 'admin-1',
      });

      expect(result).toEqual({
        revoked: true,
        revokedAt: expect.any(Date),
        sessionsRevoked: 1,
      });
      expect(prismaMock.device.findFirst).toHaveBeenCalledWith({
        where: { id: 'dev-1', userId: 'user-1' },
        select: { id: true, model: true, platform: true, revokedAt: true },
      });
    });

    it('404s a device that belongs to another user', async () => {
      prismaMock.device.findFirst.mockResolvedValue(null);

      await expect(
        service.revokeUserDevice({ userId: 'user-1', deviceId: 'dev-x', actorUserId: 'admin-1' }),
      ).rejects.toThrow('Device not found for this user.');
    });

    it('reports an already revoked device without writing', async () => {
      prismaMock.device.findFirst.mockResolvedValue({
        id: 'dev-1',
        model: null,
        platform: 'IOS',
        revokedAt: new Date(),
      });

      await expect(
        service.revokeUserDevice({ userId: 'user-1', deviceId: 'dev-1', actorUserId: 'admin-1' }),
      ).resolves.toEqual({ revoked: false, alreadyRevoked: true });
      expect(prismaMock.device.update).not.toHaveBeenCalled();
    });
  });

  describe('adjustCredits()', () => {
    it('delegates a signed adjustment to the credits ledger and audits it', async () => {
      prismaMock.merchant.findUnique.mockResolvedValue({
        id: 'merchant-1',
        businessName: 'Selam Coffee',
        creditsBalance: 10n,
        deletedAt: null,
      });
      creditsMock.adjust.mockResolvedValue({
        previousBalance: 10n,
        newBalance: 15n,
        txId: 'tx-1',
      });

      const result = await service.adjustCredits({
        merchantId: 'merchant-1',
        amount: 5n,
        reason: 'goodwill for outage',
        actorUserId: 'admin-1',
      });

      expect(creditsMock.adjust).toHaveBeenCalledWith({
        merchantId: 'merchant-1',
        amount: 5n,
        reason: 'goodwill for outage',
        actorUserId: 'admin-1',
      });
      expect(result).toMatchObject({
        amount: '5',
        previousBalance: '10',
        newBalance: '15',
        ledgerTxId: 'tx-1',
      });
      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'admin.credits.adjusted' }),
      );
    });

    it('rejects a zero amount before touching the ledger', async () => {
      await expect(
        service.adjustCredits({
          merchantId: 'merchant-1',
          amount: 0n,
          reason: 'oops',
          actorUserId: 'admin-1',
        }),
      ).rejects.toThrow('cannot be zero');
      expect(creditsMock.adjust).not.toHaveBeenCalled();
    });

    it('rejects a too-short reason', async () => {
      await expect(
        service.adjustCredits({
          merchantId: 'merchant-1',
          amount: -5n,
          reason: 'ab',
          actorUserId: 'admin-1',
        }),
      ).rejects.toThrow('reason');
    });

    it('404s an unknown merchant', async () => {
      prismaMock.merchant.findUnique.mockResolvedValue(null);

      await expect(
        service.adjustCredits({
          merchantId: 'merchant-1',
          amount: -5n,
          reason: 'removing credits',
          actorUserId: 'admin-1',
        }),
      ).rejects.toThrow('Merchant not found.');
      expect(creditsMock.adjust).not.toHaveBeenCalled();
    });
  });

  describe('getCreditsOverview()', () => {
    it('fills the 30-day series and stringifies totals', async () => {
      const day = new Date();
      day.setUTCHours(0, 0, 0, 0);
      const key = day.toISOString().slice(0, 10);

      prismaMock.creditTransaction.groupBy
        .mockResolvedValueOnce([
          { type: 'GRANT', _sum: { amount: 1000n }, _count: { _all: 4 } },
          { type: 'CONSUME', _sum: { amount: -250n }, _count: { _all: 250 } },
          { type: 'ADJUSTMENT', _sum: { amount: 5n }, _count: { _all: 1 } },
        ])
        .mockResolvedValueOnce([
          { merchantId: 'merchant-1', _sum: { amount: -200n } },
        ]);
      prismaMock.merchant.aggregate.mockResolvedValue({ _sum: { creditsBalance: 750n } });
      prismaMock.package.findMany.mockResolvedValue([{ code: 'BUSINESS_PRO' }]);
      prismaMock.$queryRaw.mockResolvedValue([
        { day: key, granted: '1000', consumed: '250' },
      ]);
      prismaMock.merchant.findMany.mockResolvedValue([
        {
          id: 'merchant-1',
          businessName: 'Selam Coffee',
          creditsBalance: 750n,
          currentPackageCode: 'PREMIUM',
          owner: { fullName: 'Selam', phone: '+251911000111' },
        },
      ]);
      prismaMock.merchant.count.mockResolvedValueOnce(10).mockResolvedValueOnce(1).mockResolvedValueOnce(1);
      prismaMock.auditLog.findMany.mockResolvedValue([
        {
          id: 'audit-1',
          targetId: 'merchant-1',
          metadata: { businessName: 'Selam Coffee', amount: '5', newBalance: '755', reason: 'goodwill' },
          createdAt: new Date(),
          actorUser: { fullName: 'Fuad', googleEmail: 'fuad@example.com' },
        },
      ]);

      const overview = await service.getCreditsOverview();

      expect(overview.series).toHaveLength(30);
      expect(overview.series[29]).toEqual({ date: key, granted: 1000, consumed: 250 });
      expect(overview.totals).toMatchObject({
        granted: '1000',
        consumed: '250',
        netIssued: '750',
        cachedBalanceTotal: '750',
        unlimitedMerchants: 1,
        ledgerRows: 255,
      });
      expect(overview.topConsumers[0]).toMatchObject({
        businessName: 'Selam Coffee',
        consumed: '200',
      });
      expect(overview.recentAdjustments[0]).toMatchObject({
        amount: '5',
        newBalance: '755',
        actorEmail: 'fuad@example.com',
      });
    });
  });

  describe('changeUserRole()', () => {
    it('moves a sub-merchant back to merchant and audits the change', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: 'SUB_MERCHANT',
        ownedMerchant: { id: 'merchant-1' },
        subMerchantProfile: { id: 'sub-1' },
      });

      const result = await service.changeUserRole({
        userId: 'user-1',
        role: 'MERCHANT' as any,
        actorUserId: 'admin-1',
        reason: 'branch closed',
      });

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { role: 'MERCHANT' },
      });
      expect(result).toEqual({ changed: true, role: 'MERCHANT' });
      expect(auditMock.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'admin.user.role_changed' }),
      );
    });

    it('refuses to change an admin role', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: 'ADMIN',
        ownedMerchant: null,
        subMerchantProfile: null,
      });

      await expect(
        service.changeUserRole({
          userId: 'user-1',
          role: 'MERCHANT' as any,
          actorUserId: 'admin-1',
        }),
      ).rejects.toThrow('allowlist');
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it('requires the target membership record', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: 'MERCHANT',
        ownedMerchant: { id: 'merchant-1' },
        subMerchantProfile: null,
      });

      await expect(
        service.changeUserRole({
          userId: 'user-1',
          role: 'SUB_MERCHANT' as any,
          actorUserId: 'admin-1',
        }),
      ).rejects.toThrow('no sub-merchant membership');
    });

    it('refuses self role changes', async () => {
      await expect(
        service.changeUserRole({
          userId: 'admin-1',
          role: 'MERCHANT' as any,
          actorUserId: 'admin-1',
        }),
      ).rejects.toThrow('your own role');
      expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('adjustUserCredits()', () => {
    it('credits the owned merchant', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-1',
        ownedMerchant: { id: 'merchant-1' },
        subMerchantProfile: null,
      });
      prismaMock.merchant.findUnique.mockResolvedValue({
        id: 'merchant-1',
        businessName: 'Selam Coffee',
        creditsBalance: 10n,
        deletedAt: null,
      });
      creditsMock.adjust.mockResolvedValue({ previousBalance: 10n, newBalance: 20n, txId: 'tx-2' });

      const result = await service.adjustUserCredits({
        userId: 'user-1',
        amount: 10n,
        reason: 'phase b check',
        actorUserId: 'admin-1',
      });

      expect(creditsMock.adjust).toHaveBeenCalledWith(
        expect.objectContaining({ merchantId: 'merchant-1', amount: 10n }),
      );
      expect(result).toMatchObject({ userId: 'user-1', newBalance: '20', ledgerTxId: 'tx-2' });
    });

    it('uses the parent merchant for a sub-merchant', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-2',
        ownedMerchant: null,
        subMerchantProfile: { merchant: { id: 'merchant-9' } },
      });
      prismaMock.merchant.findUnique.mockResolvedValue({
        id: 'merchant-9',
        businessName: 'Branch Co',
        creditsBalance: 4n,
        deletedAt: null,
      });
      creditsMock.adjust.mockResolvedValue({ previousBalance: 4n, newBalance: 3n, txId: 'tx-3' });

      await service.adjustUserCredits({
        userId: 'user-2',
        amount: -1n,
        reason: 'refund reversal',
        actorUserId: 'admin-1',
      });

      expect(creditsMock.adjust).toHaveBeenCalledWith(
        expect.objectContaining({ merchantId: 'merchant-9', amount: -1n }),
      );
    });

    it('rejects a user without a merchant account', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-3',
        ownedMerchant: null,
        subMerchantProfile: null,
      });

      await expect(
        service.adjustUserCredits({
          userId: 'user-3',
          amount: 1n,
          reason: 'no merchant',
          actorUserId: 'admin-1',
        }),
      ).rejects.toThrow('no merchant account');
    });
  });

  describe('getMerchantCreditStats()', () => {
    it('returns usage rows with balances and last top-up', async () => {
      const topUp = new Date('2026-11-01T09:00:00.000Z');
      prismaMock.$queryRaw
        .mockResolvedValueOnce([
          {
            id: 'merchant-1',
            businessName: 'Selam Coffee',
            creditsBalance: '755',
            consumed30d: '120',
            lastTopUp: topUp,
          },
        ])
        .mockResolvedValueOnce([{ count: 1 }]);

      const result = await service.getMerchantCreditStats({ page: 1, pageSize: 20 });

      expect(result).toMatchObject({ total: 1, page: 1, pageSize: 20, totalPages: 1 });
      expect(result.merchants[0]).toMatchObject({
        merchantId: 'merchant-1',
        businessName: 'Selam Coffee',
        creditsBalance: '755',
        consumed30d: '120',
        lastTopUp: topUp.toISOString(),
      });
    });
  });
});
