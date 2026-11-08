// ============================================================
// Yene Verify â€” Google Auth Service Unit Tests
// Stubbed firebase-admin.verifyIdToken; mocked prisma/redis/token/session/device/audit.
// ============================================================

import { GoogleAuthService } from './google-auth.service';
import { GoogleNotLinkedError, GoogleEmailUnverifiedError, GoogleTokenInvalidError } from './errors/google-auth.errors';

const configMock: any = { jwt: { accessTtl: '15m' } };
const prismaMock: any = {
  user: { findUnique: jest.fn(), update: jest.fn() },
};
const tokenServiceMock: any = { signAccessToken: jest.fn().mockReturnValue('access-token') };
const sessionServiceMock: any = {
  createSession: jest.fn().mockResolvedValue({ sessionId: 'sess-1', rawRefreshToken: 'refresh-token' }),
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
      const { GoogleAlreadyLinkedError } = await import('./errors/google-auth.errors');
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
