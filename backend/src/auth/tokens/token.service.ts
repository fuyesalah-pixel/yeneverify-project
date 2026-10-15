// ============================================================
// Yene Verify — Token Service
// Handles access token signing/verification and opaque refresh tokens.
// ============================================================

import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import { AppConfigService } from '../../config/config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { InvalidTokenError, TokenExpiredError } from '../errors';

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

interface TokenPair {
  accessToken: string;
  refreshToken: string;
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
   * Generate both access and refresh tokens for a new session.
   */
  generateTokens(
    userId: string,
    role: string,
    merchantId: string | undefined,
    deviceId: string,
  ): TokenPair {
    const accessToken = this.signAccessToken({
      sub: userId,
      role,
      merchantId,
      sid: '', // Will be filled by SessionService
      did: deviceId,
    });

    const { raw: refreshToken } = this.generateRefreshToken();
    return { accessToken, refreshToken };
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
          select: { id: true, revokedAt: true },
        },
      },
    });

    if (!session) {
      throw new InvalidTokenError('Refresh token not found');
    }

    if (session.revokedAt) {
      // Reuse detected - revoke all sessions for this user
      await this.revokeAllUserSessions(session.userId, 'reuse_detected');
      throw new Error('REFRESH_REUSE_DETECTED');
    }

    if (session.expiresAt < new Date()) {
      throw new Error('REFRESH_EXPIRED');
    }

    if (session.device.revokedAt) {
      throw new Error('DEVICE_REVOKED');
    }

    if (session.user.status !== 'ACTIVE') {
      throw new Error('USER_INACTIVE');
    }

    return session;
  }

  /**
   * Rotate refresh token: revoke current session, create new one.
   */
  async rotateRefreshToken(
    oldRawToken: string,
    userId: string,
    deviceId: string,
    ip?: string,
    userAgent?: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const oldHash = this.hashRefreshToken(oldRawToken);

    const newSession = await this.prisma.$transaction(async (tx) => {
      // Revoke old session
      await tx.session.update({
        where: { refreshTokenHash: oldHash },
        data: { revokedAt: new Date() },
      });

      // Create new session
      const { raw, hash } = this.generateRefreshToken();
      const session = await tx.session.create({
        data: {
          id: crypto.randomUUID(),
          userId,
          deviceId,
          refreshTokenHash: hash,
          ip,
          userAgent,
          expiresAt: new Date(Date.now() + this.parseTtl(this.config.jwt.refreshTtl)),
        },
        include: {
          user: { select: { role: true, ownedMerchant: { select: { id: true } } } },
        },
      });
      return { session, raw };
    });

    // Generate new access token
    const accessToken = this.signAccessToken({
      sub: userId,
      role: newSession.session.user.role,
      merchantId: newSession.session.user.ownedMerchant?.id,
      sid: newSession.session.id,
      did: deviceId,
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
