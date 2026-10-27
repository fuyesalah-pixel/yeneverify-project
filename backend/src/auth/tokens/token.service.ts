// ============================================================
// Yene Verify — Token Service
// Handles access token signing/verification and opaque refresh tokens.
// ============================================================

import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import { AppConfigService } from '../../config/config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { InvalidTokenError, TokenExpiredError, RefreshTokenInvalidError, RefreshTokenExpiredError, RefreshTokenReuseDetectedError, DeviceRevokedError, AccountSuspendedError } from '../errors';

interface AccessTokenClaims {
  sub: string;
  role: string;
  merchantId?: string;
  sid: string;
  did: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

interface RefreshTokenPair {
  raw: string;
  hash: string;
}

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly jwt: JwtService;

  constructor(
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.jwt = new JwtService({
      secret: config.jwt.accessSecret,
      signOptions: {
        expiresIn: config.jwt.accessTtl,
        issuer: config.jwt.issuer,
        audience: config.jwt.audience,
      },
    });
  }

  /**
   * Sign an access token with the given claims.
   */
  signAccessToken(claims: Omit<AccessTokenClaims, 'iat' | 'exp' | 'iss' | 'aud'>): string {
    if (!claims.sid) {
      // Never sign a token with no session id — jwt.strategy does a DB lookup
      // by sid and an empty string would 500 every authenticated call.
      throw new InvalidTokenError('Access token requires a real session id (sid)');
    }
    return this.jwt.sign(claims);
  }

  /**
   * Verify and decode an access token.
   * Throws on invalid/expired token.
   */
  async verifyAccessToken(token: string): Promise<AccessTokenClaims> {
    try {
      const decoded = await this.jwt.verifyAsync<AccessTokenClaims>(token, {
        secret: this.config.jwt.accessSecret,
        issuer: this.config.jwt.issuer,
        audience: this.config.jwt.audience,
      });
      return decoded;
    } catch (error) {
      const err = error as Error & { name?: string };
      if (err.name === 'TokenExpiredError') {
        throw new TokenExpiredError();
      }
      throw new InvalidTokenError();
    }
  }

  /**
   * Generate a new refresh token pair (raw + hashed).
   */
  generateRefreshToken(): RefreshTokenPair {
    const raw = randomBytes(64).toString('base64url');
    const hash = this.hashRefreshToken(raw);
    return { raw, hash };
  }

  /**
   * Hash a refresh token using SHA-256.
   */
  hashRefreshToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  /**
   * Validate a refresh token against the database.
   * Returns the session if valid and not revoked.
   */
  async validateRefreshToken(rawToken: string) {
    const hash = this.hashRefreshToken(rawToken);

    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: hash },
      include: {
        user: {
          select: { id: true, role: true, status: true, ownedMerchant: { select: { id: true } } },
        },
        device: {
          select: { id: true, revokedAt: true, deviceFingerprint: true, platform: true },
        },
      },
    });

    if (!session) {
      throw new RefreshTokenInvalidError('Refresh token not found');
    }

    if (session.revokedAt) {
      // Reuse detected - revoke all sessions for this user
      await this.revokeAllUserSessions(session.userId, 'reuse_detected');
      throw new RefreshTokenReuseDetectedError();
    }

    if (session.expiresAt < new Date()) {
      throw new RefreshTokenExpiredError();
    }

    if (session.device.revokedAt) {
      throw new DeviceRevokedError();
    }

    if (session.user.status !== 'ACTIVE') {
      throw new AccountSuspendedError('Refresh token belongs to an inactive account.');
    }

    return session;
  }

  /**
   * Rotate refresh token: validate the raw token, revoke its session, and
   * create a fresh one in one transaction.
   *
   * User and device come from the validated session row — callers must NOT
   * pass them in (the old signature let auth flows pass empty strings, which
   * violated the deviceId FK and broke every refresh).
   *
   * Throws RefreshTokenInvalidError / ReuseDetected / Expired / DeviceRevoked.
   */
  async rotateRefreshToken(
    oldRawToken: string,
    ip?: string,
    userAgent?: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const oldSession = await this.validateRefreshToken(oldRawToken);
    const oldHash = this.hashRefreshToken(oldRawToken);

    const newSession = await this.prisma.$transaction(async (tx) => {
      // Revoke old session
      await tx.session.update({
        where: { refreshTokenHash: oldHash, id: oldSession.id },
        data: { revokedAt: new Date() },
      });

      // Create new session for the same user/device
      const { raw, hash } = this.generateRefreshToken();
      const session = await tx.session.create({
        data: {
          id: crypto.randomUUID(),
          userId: oldSession.userId,
          deviceId: oldSession.deviceId,
          refreshTokenHash: hash,
          ip: ip ?? oldSession.ip ?? undefined,
          userAgent: userAgent ?? oldSession.userAgent ?? undefined,
          expiresAt: new Date(Date.now() + this.parseTtl(this.config.jwt.refreshTtl)),
        },
        include: {
          user: { select: { role: true, ownedMerchant: { select: { id: true } } } },
        },
      });
      return { session, raw };
    });

    // Generate new access token with the real session id
    const accessToken = this.signAccessToken({
      sub: newSession.session.userId,
      role: newSession.session.user.role,
      merchantId: newSession.session.user.ownedMerchant?.id,
      sid: newSession.session.id,
      did: newSession.session.deviceId,
    });

    return { accessToken, refreshToken: newSession.raw };
  }

  /**
   * Revoke a specific session.
   */
  async revokeSession(sessionId: string): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Revoke all sessions for a user.
   */
  async revokeAllUserSessions(userId: string, reason = 'logout_all'): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    this.logger.log({
      event: 'auth.sessions.revoked_all',
      userId,
      reason,
    });
  }

  /**
   * Prune old sessions (revoked > 30 days or expired > 30 days).
   * Called by scheduled job.
   */
  async pruneOldSessions(): Promise<number> {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const result = await this.prisma.session.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: cutoff } }, { revokedAt: { lt: cutoff } }],
      },
    });
    return result.count;
  }

  private parseTtl(ttl: string): number {
    const match = ttl.match(/^(\d+)([smhd])$/);
    if (!match) return 30 * 24 * 60 * 60 * 1000;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    switch (unit) {
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      default:
        return 30 * 24 * 60 * 60 * 1000;
    }
  }
}
