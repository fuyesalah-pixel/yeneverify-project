// ============================================================
// Yene Verify â€” Google Auth Service
// Verifies Google ID tokens, links/unlinks Google accounts, and issues
// the same session tokens as OTP login. Phone remains the primary identity.
// ============================================================

import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../config/config.service';
import { PrismaService } from '../prisma/prisma.service';
import { TokenService } from '../auth/tokens/token.service';
import { SessionService } from '../auth/session/session.service';
import { DeviceService } from '../auth/device/device.service';
import { AuditService } from '../audit/audit.service';
import { RedisService } from '../redis/redis.service';
import { DevicePlatform } from '@prisma/client';
import {
  GoogleAlreadyLinkedError,
  GoogleEmailUnverifiedError,
  GoogleNotLinkedError,
  GoogleTokenInvalidError,
} from './errors/google-auth.errors';

const RATE_LIMIT_TTL_SECONDS = 60 * 60; // 1 hour
const RATE_LIMIT_MAX = 5;

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class GoogleAuthService {
  constructor(
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly sessionService: SessionService,
    private readonly deviceService: DeviceService,
    private readonly audit: AuditService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Verify a Google ID token and, if the Google account is linked to a user,
   * issue the same access + refresh tokens as OTP login.
   */
  async login(dto: {
    idToken: string;
    ip?: string;
    userAgent?: string;
    fingerprint?: string;
    platform?: 'ANDROID' | 'IOS';
  }): Promise<GoogleTokens> {
    const { idToken, ip, userAgent, fingerprint, platform } = dto;

    // Rate limit: 5 per IP per hour
    if (ip) {
      const key = `google-auth:ip:${ip}`;
      const count = await this.redis.incr(key, RATE_LIMIT_TTL_SECONDS);
      if (count > RATE_LIMIT_MAX) {
        throw new AppErrorRateLimited();
      }
    }

    let decoded;
    try {
      decoded = await this.verifyIdToken(idToken);
    } catch {
      throw new GoogleTokenInvalidError();
    }

    if (!decoded.email_verified) {
      throw new GoogleEmailUnverifiedError();
    }

    const user = await this.prisma.user.findUnique({
      where: { googleUid: decoded.sub },
    });

    if (!user) {
      throw new GoogleNotLinkedError();
    }

    if (user.status === 'BANNED') {
      this.audit.log({
        actorType: 'USER',
        actorUserId: user.id,
        action: 'auth.google.login.fail',
        targetType: 'user',
        targetId: user.id,
        ip,
        userAgent,
        metadata: { reason: 'banned', email: decoded.email },
      });
      throw new Error('account banned');
    }

    const device = await this.deviceService.resolveOrCreate(
      user.id,
      fingerprint ?? `google:${ip ?? 'unknown'}`,
      (platform ?? DevicePlatform.ANDROID) as DevicePlatform,
      undefined,
      undefined,
      undefined,
      undefined,
    );

    const { sessionId, rawRefreshToken } = await this.sessionService.createSession(
      user.id,
      device.id,
      ip,
      userAgent,
    );
    const accessToken = this.tokenService.signAccessToken({
      sub: user.id,
      role: user.role,
      merchantId: undefined,
      sid: sessionId,
      did: device.id,
    });

    this.audit.log({
      actorType: 'USER',
      actorUserId: user.id,
      action: 'auth.google.login.success',
      targetType: 'user',
      targetId: user.id,
      ip,
      userAgent,
      metadata: { email: decoded.email, deviceId: device.id },
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: this.parseTtl(String(this.config.jwt.accessTtl ?? '15m')) / 1000,
    };
  }

  /**
   * Link a Google account to the currently authenticated user.
   * Requires JWT (JwtAuthGuard).
   */
  async link(userId: string, dto: { idToken: string; ip?: string; userAgent?: string }) {
    const { idToken, ip, userAgent } = dto;

    let decoded;
    try {
      decoded = await this.verifyIdToken(idToken);
    } catch {
      throw new GoogleTokenInvalidError();
    }

    if (!decoded.email_verified) {
      throw new GoogleEmailUnverifiedError();
    }

    // Reject if this Google uid is already linked to a different user.
    const existing = await this.prisma.user.findUnique({
      where: { googleUid: decoded.sub },
    });
    if (existing && existing.id !== userId) {
      throw new GoogleAlreadyLinkedError();
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        googleUid: decoded.sub,
        googleEmail: decoded.email,
        googleLinkedAt: new Date(),
      },
    });

    this.audit.log({
      actorType: 'USER',
      actorUserId: user.id,
      action: 'auth.google.linked',
      targetType: 'user',
      targetId: user.id,
      ip,
      userAgent,
      metadata: { email: decoded.email },
    });

    return { ok: true };
  }

  /**
   * Unlink the Google account from the currently authenticated user.
   * Requires JWT (JwtAuthGuard).
   */
  async unlink(userId: string, dto: { ip?: string; userAgent?: string }) {
    const { ip, userAgent } = dto;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        googleUid: null,
        googleEmail: null,
        googleLinkedAt: null,
      },
    });

    this.audit.log({
      actorType: 'USER',
      actorUserId: userId,
      action: 'auth.google.unlinked',
      targetType: 'user',
      targetId: userId,
      ip,
      userAgent,
    });

    return { ok: true };
  }

  // firebase-admin is the production verifier; injected indirectly through
  // config in production. For unit tests we stub verifyIdToken below.
  private async verifyIdToken(idToken: string): Promise<{
    sub: string;
    email: string;
    email_verified: boolean;
  }> {
    // Production: firebase-admin.auth().verifyIdToken(idToken).
    // Imported lazily so the module loads in environments without the SDK
    // configured (unit tests stub this method).
    const { getAuth } = await import('firebase-admin/auth');
    const decoded = await getAuth().verifyIdToken(idToken);
    return {
      sub: decoded.uid,
      email: decoded.email ?? '',
      email_verified: !!decoded.email_verified,
    };
  }

  private parseTtl(ttl: string): number {
    const match = ttl.match(/^(\d+)([smhd])$/);
    if (!match) return 15 * 60 * 1000;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 15 * 60 * 1000;
    }
  }
}

// Inline rate-limit error (kept out of the shared error file to avoid a
// circular import; uses the centralized RATE_LIMITED code).
class AppErrorRateLimited extends Error {
  constructor() {
    super('Too many Google sign-in attempts. Please try again later.');
    Object.setPrototypeOf(this, new.target.prototype);
  }
  public readonly code = 'RATE_LIMITED' as const;
  public readonly httpStatus = 429;
}
