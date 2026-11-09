// ============================================================
// Yene Verify â€” Google Auth Service Unit Tests
// Stubbed firebase-admin.verifyIdToken; mocked prisma/redis/token/session/device/audit.
// ============================================================

import { GoogleAuthService } from './google-auth.service';
import {
  GoogleNotLinkedError,
  GoogleEmailUnverifiedError,
  GoogleTokenInvalidError,
  GoogleAlreadyLinkedError,
  GoogleAlreadyPairedError,
  DeviceLimitPairsError,
  PhoneAlreadyPairedError,
  PhoneInvalidFormatError,
} from './errors/google-auth.errors';

const configMock: any = { jwt: { accessTtl: '15m' } };
const prismaMock: any = {
  user: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn(), findMany: jest.fn() },
  userDevice: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
  },
  device: { findFirst: jest.fn(), create: jest.fn() },
};
const tokenServiceMock: any = { signAccessToken: jest.fn().mockReturnValue('access-token') };
const sessionServiceMock: any = {
  createSession: jest
    .fn()
    .mockResolvedValue({ sessionId: 'sess-1', rawRefreshToken: 'refresh-token' }),
};
const deviceServiceMock: any = { resolveOrCreate: jest.fn().mockResolvedValue({ id: 'dev-1' }) };
const redisMock: any = { incr: jest.fn().mockResolvedValue(1) };
const auditMock: any = { log: jest.fn() };

function buildService() {
  return new GoogleAuthService(
    configMock,
    prismaMock,
    tokenServiceMock,
    sessionServiceMock,
    deviceServiceMock,
    auditMock,
    redisMock,
  );
}

describe('GoogleAuthService', () => {
  let service: GoogleAuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = buildService();
  });

  describe('login()', () => {
    it('issues tokens for a linked Google user', async () => {
      (service as any).verifyIdToken = jest.fn().mockResolvedValue({
        sub: 'google-uid-1',
        email: 'fuad@example.com',
        email_verified: true,
      });
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-1',
        role: 'ADMIN',
        status: 'ACTIVE',
      });

      const out = await service.login({ idToken: 'tok', ip: '1.2.3.4' });

      expect(out).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 900,
      });
      expect(redisMock.incr).toHaveBeenCalledWith('google-auth:ip:1.2.3.4', 3600);
      expect(sessionServiceMock.createSession).toHaveBeenCalledWith(
        'user-1',
        'dev-1',
        '1.2.3.4',
        undefined,
      );
      expect(tokenServiceMock.signAccessToken).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 'user-1', role: 'ADMIN', sid: 'sess-1', did: 'dev-1' }),
      );
    });

    it('throws GoogleNotLinkedError when no user is linked', async () => {
      (service as any).verifyIdToken = jest.fn().mockResolvedValue({
        sub: 'google-uid-2',
        email: 'x@example.com',
        email_verified: true,
      });
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(service.login({ idToken: 'tok', ip: '1.2.3.4' })).rejects.toBeInstanceOf(
        GoogleNotLinkedError,
      );
    });

    it('throws GoogleEmailUnverifiedError when email not verified', async () => {
      (service as any).verifyIdToken = jest.fn().mockResolvedValue({
        sub: 'google-uid-3',
        email: 'x@example.com',
        email_verified: false,
      });

      await expect(service.login({ idToken: 'tok' })).rejects.toBeInstanceOf(
        GoogleEmailUnverifiedError,
      );
    });

    it('throws GoogleTokenInvalidError when verifyIdToken fails', async () => {
      (service as any).verifyIdToken = jest.fn().mockRejectedValue(new Error('invalid'));

      await expect(service.login({ idToken: 'bad' })).rejects.toBeInstanceOf(
        GoogleTokenInvalidError,
      );
    });

    it('rate limits at 5 per IP per hour', async () => {
      (service as any).verifyIdToken = jest.fn().mockResolvedValue({
        sub: 'google-uid-4',
        email: 'x@example.com',
        email_verified: true,
      });
      prismaMock.user.findUnique.mockResolvedValue({ id: 'u', role: 'MERCHANT', status: 'ACTIVE' });
      redisMock.incr.mockResolvedValue(6);

      await expect(service.login({ idToken: 'tok', ip: '1.2.3.4' })).rejects.toMatchObject({
        httpStatus: 429,
      });
    });
  });

  describe('onboard()', () => {
    const validDto = {
      idToken: 'tok',
      phone: '+251911111111',
      fullName: 'Fuad Salah',
      device: {
        fingerprint: 'fp-device-1',
        platform: 'ANDROID' as const,
        model: 'Pixel 7',
        osVersion: '13',
        appVersion: '1.0.0',
      },
      ip: '1.2.3.4',
    };

    it('creates user, pairs phone, tracks device, returns tokens', async () => {
      (service as any).verifyIdToken = jest.fn().mockResolvedValue({
        sub: 'google-uid-1',
        email: 'fuad@example.com',
        email_verified: true,
      });
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.userDevice.findMany.mockResolvedValue([]);
      prismaMock.user.create.mockResolvedValue({
        id: 'user-1',
        phone: '+251911111111',
        fullName: 'Fuad Salah',
        googleUid: 'google-uid-1',
        googleEmail: 'fuad@example.com',
        status: 'ACTIVE',
      });
      prismaMock.device.findFirst.mockResolvedValue(null);
      prismaMock.device.create.mockResolvedValue({ id: 'dev-new' });

      const out = await service.onboard(validDto);

      expect(out.ok).toBe(true);
      expect(out.needsOnboarding).toBe(true);
      expect(out.user.phone).toBe('+251911111111');
      expect(out.user.googleUid).toBe('google-uid-1');
      expect(out.accessToken).toBe('access-token');
      expect(out.refreshToken).toBe('refresh-token');
      expect(prismaMock.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            phone: '+251911111111',
            googleUid: 'google-uid-1',
            phonePairedAt: expect.any(Date),
          }),
        }),
      );
      expect(prismaMock.userDevice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            deviceFingerprint: 'fp-device-1',
          }),
        }),
      );
    });

    it('rejects with DeviceLimitPairsError when 2 accounts already on device', async () => {
      (service as any).verifyIdToken = jest.fn().mockResolvedValue({
        sub: 'google-uid-3',
        email: 'newuser@example.com',
        email_verified: true,
      });
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.userDevice.findMany.mockResolvedValue([
        { id: 'ud-1', userId: 'u1', user: { phone: '+251911111111', phonePairedAt: new Date() } },
        { id: 'ud-2', userId: 'u2', user: { phone: '+251922222222', phonePairedAt: new Date() } },
      ]);

      await expect(service.onboard(validDto)).rejects.toBeInstanceOf(DeviceLimitPairsError);
    });

    it('rejects with PhoneAlreadyPairedError when phone is already paired', async () => {
      (service as any).verifyIdToken = jest.fn().mockResolvedValue({
        sub: 'google-uid-4',
        email: 'x@example.com',
        email_verified: true,
      });
      prismaMock.userDevice.findMany.mockResolvedValue([]);
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'existing-user',
        phone: '+251911111111',
        phonePairedAt: new Date(),
      });

      await expect(service.onboard(validDto)).rejects.toBeInstanceOf(PhoneAlreadyPairedError);
    });

    it('rejects with GoogleAlreadyPairedError when google_uid is already paired', async () => {
      (service as any).verifyIdToken = jest.fn().mockResolvedValue({
        sub: 'google-uid-5',
        email: 'x@example.com',
        email_verified: true,
      });
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.userDevice.findMany.mockResolvedValue([]);
      prismaMock.user.findUnique.mockResolvedValueOnce(null);
      // Second findUnique (by googleUid) returns a paired user
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: 'google-user',
        phone: '+251933333333',
        phonePairedAt: new Date(),
        googleUid: 'google-uid-5',
      });

      await expect(service.onboard(validDto)).rejects.toBeInstanceOf(GoogleAlreadyPairedError);
    });

    it('rejects with PhoneInvalidFormatError for invalid phone', async () => {
      (service as any).verifyIdToken = jest.fn().mockResolvedValue({
        sub: 'google-uid-6',
        email: 'x@example.com',
        email_verified: true,
      });

      await expect(service.onboard({ ...validDto, phone: '0911111111' })).rejects.toBeInstanceOf(
        PhoneInvalidFormatError,
      );
    });
  });

  describe('signin()', () => {
    const validDto = {
      idToken: 'tok',
      device: {
        fingerprint: 'fp-device-1',
        platform: 'ANDROID' as const,
      },
      ip: '1.2.3.4',
    };

    it('issues tokens for returning user on known device', async () => {
      (service as any).verifyIdToken = jest.fn().mockResolvedValue({
        sub: 'google-uid-1',
        email: 'fuad@example.com',
        email_verified: true,
      });
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-1',
        phone: '+251911111111',
        fullName: 'Fuad Salah',
        googleUid: 'google-uid-1',
        googleEmail: 'fuad@example.com',
        status: 'ACTIVE',
      });
      prismaMock.userDevice.findUnique.mockResolvedValue({ id: 'ud-1' });
      prismaMock.device.findFirst.mockResolvedValue({ id: 'dev-1' });

      const out = await service.signin(validDto);

      expect(out.ok).toBe(true);
      expect(out.needsOnboarding).toBe(false);
      expect(out.user.phone).toBe('+251911111111');
      expect(out.accessToken).toBe('access-token');
    });

    it('throws GoogleNotLinkedError when no user is linked', async () => {
      (service as any).verifyIdToken = jest.fn().mockResolvedValue({
        sub: 'google-uid-2',
        email: 'x@example.com',
        email_verified: true,
      });
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(service.signin(validDto)).rejects.toBeInstanceOf(GoogleNotLinkedError);
    });

    it('rejects with DeviceLimitPairsError when device at limit for new user', async () => {
      (service as any).verifyIdToken = jest.fn().mockResolvedValue({
        sub: 'google-uid-7',
        email: 'newuser@example.com',
        email_verified: true,
      });
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-7',
        phone: '+251977777777',
        fullName: 'New User',
        googleUid: 'google-uid-7',
        googleEmail: 'newuser@example.com',
        status: 'ACTIVE',
      });
      prismaMock.userDevice.findUnique.mockResolvedValue(null); // not paired to this device
      prismaMock.userDevice.count.mockResolvedValue(2); // at limit
      prismaMock.userDevice.findMany.mockResolvedValue([
        { id: 'ud-1', userId: 'u1', user: { phone: '+251911111111' } },
        { id: 'ud-2', userId: 'u2', user: { phone: '+251922222222' } },
      ]);
      prismaMock.device.findFirst.mockResolvedValue({ id: 'dev-1' });

      await expect(service.signin(validDto)).rejects.toBeInstanceOf(DeviceLimitPairsError);
    });
  });

  describe('getDeviceAccounts()', () => {
    it('returns paired accounts for device', async () => {
      prismaMock.userDevice.findMany.mockResolvedValue([
        {
          id: 'ud-1',
          user: { phone: '+251911111111', googleEmail: 'user1@gmail.com' },
        },
        {
          id: 'ud-2',
          user: { phone: '+251922222222', googleEmail: 'user2@gmail.com' },
        },
      ]);

      const out = await service.getDeviceAccounts('fp-device-1');

      expect(out.accounts).toEqual([
        { phoneLast4: '+2519****1111', googleEmail: 'user1@gmail.com' },
        { phoneLast4: '+2519****2222', googleEmail: 'user2@gmail.com' },
      ]);
    });

    it('returns empty array when no accounts on device', async () => {
      prismaMock.userDevice.findMany.mockResolvedValue([]);

      const out = await service.getDeviceAccounts('fp-empty');

      expect(out.accounts).toEqual([]);
    });
  });

  describe('signoutDeviceAccount()', () => {
    it('removes device binding for matching phone last-4', async () => {
      prismaMock.user.findMany.mockResolvedValue([
        { id: 'user-1', phone: '+251911111111' },
        { id: 'user-2', phone: '+251922222222' },
      ]);
      prismaMock.userDevice.deleteMany.mockResolvedValue({ count: 1 });

      await service.signoutDeviceAccount({
        phoneLast4: '1111',
        deviceFingerprint: 'fp-device-1',
      });

      expect(prismaMock.userDevice.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', deviceFingerprint: 'fp-device-1' },
      });
    });

    it('is idempotent when no matching user found', async () => {
      prismaMock.user.findMany.mockResolvedValue([]);
      prismaMock.userDevice.deleteMany.mockResolvedValue({ count: 0 });

      await service.signoutDeviceAccount({
        phoneLast4: '9999',
        deviceFingerprint: 'fp-device-1',
      });

      expect(prismaMock.userDevice.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('link()', () => {
    it('links Google account to current user', async () => {
      (service as any).verifyIdToken = jest.fn().mockResolvedValue({
        sub: 'google-uid-5',
        email: 'fuad@example.com',
        email_verified: true,
      });
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.user.update.mockResolvedValue({ id: 'user-1' });

      const out = await service.link('user-1', { idToken: 'tok', ip: '1.2.3.4' });

      expect(out).toEqual({ ok: true });
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          googleUid: 'google-uid-5',
          googleEmail: 'fuad@example.com',
          googleLinkedAt: expect.any(Date),
        },
      });
    });

    it('throws GoogleAlreadyLinkedError when uid belongs to another user', async () => {
      (service as any).verifyIdToken = jest.fn().mockResolvedValue({
        sub: 'google-uid-6',
        email: 'x@example.com',
        email_verified: true,
      });
      prismaMock.user.findUnique.mockResolvedValue({ id: 'other-user' });

      await expect(service.link('user-1', { idToken: 'tok' })).rejects.toBeInstanceOf(
        GoogleAlreadyLinkedError,
      );
    });
  });

  describe('unlink()', () => {
    it('clears Google fields', async () => {
      prismaMock.user.update.mockResolvedValue({});

      const out = await service.unlink('user-1', { ip: '1.2.3.4' });

      expect(out).toEqual({ ok: true });
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { googleUid: null, googleEmail: null, googleLinkedAt: null },
      });
    });
  });
});
