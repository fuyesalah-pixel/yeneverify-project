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
  $queryRaw: jest.fn(),
  $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
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
const firebaseAdminMock: any = {};

function buildService(): AdminService {
  return new AdminService(
    configMock,
    prismaMock,
    tokenServiceMock,
    sessionServiceMock,
    auditMock,
    redisMock,
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
  });
});
