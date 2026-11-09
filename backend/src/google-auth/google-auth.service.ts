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
  GoogleAlreadyPairedError,
  DeviceLimitPairsError,
  GoogleEmailUnverifiedError,
  GoogleNotLinkedError,
  GoogleTokenInvalidError,
  PhoneAlreadyPairedError,
  PhoneInvalidFormatError,
} from './errors/google-auth.errors';

const RATE_LIMIT_TTL_SECONDS = 60 * 60; // 1 hour
const RATE_LIMIT_MAX = 5;
const ONBOARD_RATE_LIMIT_MAX = 10;

const ETHIOPIAN_PHONE_REGEX = /^\+251[79]\d{8}$/;

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface OnboardResult {
  ok: boolean;
  user: {
    id: string;
    phone: string;
    fullName: string;
    googleUid: string;
    googleEmail: string;
  };
  accessToken: string;
  refreshToken: string;
  needsOnboarding: true;
}

export interface SigninResult {
  ok: boolean;
  user: {
    id: string;
    phone: string;
    fullName: string;
    googleUid: string;
    googleEmail: string;
  };
  accessToken: string;
  refreshToken: string;
  needsOnboarding: false;
}

export interface DeviceAccount {
  phoneLast4: string;
  googleEmail: string;
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
   * No device limit check — used for token refresh inside the app after onboarding.
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
   * First-time Google signup + phone pairing.
   * Public endpoint. Creates user, pairs phone, tracks device, issues tokens.
   */
  async onboard(dto: {
    idToken: string;
    phone: string;
    fullName: string;
    device: {
      fingerprint: string;
      platform: 'ANDROID' | 'IOS';
      model?: string;
      osVersion?: string;
      appVersion?: string;
    };
    ip?: string;
    userAgent?: string;
  }): Promise<OnboardResult> {
    const { idToken, phone, fullName, device, ip, userAgent } = dto;
    const normalizedPhone = this.normalizePhone(phone);

    // Rate limit: 10 per IP per hour
    if (ip) {
      const key = `google-onboard:ip:${ip}`;
      const count = await this.redis.incr(key, RATE_LIMIT_TTL_SECONDS);
      if (count > ONBOARD_RATE_LIMIT_MAX) {
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

    // ── Device constraint: max 2 accounts per device fingerprint ──
    const existingPairs = await this.prisma.userDevice.findMany({
      where: { deviceFingerprint: device.fingerprint },
      include: { user: { select: { phone: true, phonePairedAt: true } } },
    });

    if (existingPairs.length >= 2) {
      const existingPhones = existingPairs
        .map((p) => p.user.phone)
        .filter((p): p is string => !!p)
        .map((p) => this.maskPhone(p));
      this.audit.log({
        actorType: 'SYSTEM',
        action: 'auth.google.onboard.device_limit',
        targetType: 'device',
        targetId: device.fingerprint,
        ip,
        userAgent,
        metadata: { existingPhones, googleEmail: decoded.email },
      });
      throw new DeviceLimitPairsError(existingPhones);
    }

    // ── Phone uniqueness: phone already paired to another user ──
    const userByPhone = await this.prisma.user.findUnique({
      where: { phone: normalizedPhone },
    });
    if (userByPhone && userByPhone.phonePairedAt !== null) {
      throw new PhoneAlreadyPairedError();
    }

    // ── Google UID uniqueness ──
    const userByGoogle = await this.prisma.user.findUnique({
      where: { googleUid: decoded.sub },
    });
    if (userByGoogle && userByGoogle.phonePairedAt !== null) {
      throw new GoogleAlreadyPairedError();
    }

    // ── Create or update user ──
    let user;
    if (userByPhone) {
      // User exists with this phone but not yet paired (phonePairedAt null)
      user = await this.prisma.user.update({
        where: { id: userByPhone.id },
        data: {
          googleUid: decoded.sub,
          googleEmail: decoded.email,
          googleLinkedAt: new Date(),
          phonePairedAt: new Date(),
          fullName,
        },
      });
    } else if (userByGoogle) {
      // Google uid exists but not paired — update with phone
      user = await this.prisma.user.update({
        where: { id: userByGoogle.id },
        data: {
          phone: normalizedPhone,
          phonePairedAt: new Date(),
          googleEmail: decoded.email,
          googleLinkedAt: new Date(),
          fullName,
        },
      });
    } else {
      // Brand new user
      user = await this.prisma.user.create({
        data: {
          id: crypto.randomUUID(),
          phone: normalizedPhone,
          fullName,
          role: 'MERCHANT',
          status: 'ACTIVE',
          phonePairedAt: new Date(),
          googleUid: decoded.sub,
          googleEmail: decoded.email,
          googleLinkedAt: new Date(),
        },
      });
    }

    if (user.status === 'BANNED') {
      this.audit.log({
        actorType: 'USER',
        actorUserId: user.id,
        action: 'auth.google.onboard.fail',
        targetType: 'user',
        targetId: user.id,
        ip,
        userAgent,
        metadata: { reason: 'banned', email: decoded.email },
      });
      throw new Error('account banned');
    }

    // ── Create user-device pairing ──
    await this.prisma.userDevice.create({
      data: {
        id: crypto.randomUUID(),
        userId: user.id,
        deviceFingerprint: device.fingerprint,
        lastActiveAt: new Date(),
      },
    });

    // ── Ensure a Device row exists for session FK ──
    const deviceRecord = await this.prisma.device.findFirst({
      where: {
        userId: user.id,
        deviceFingerprint: device.fingerprint,
      },
    });
    let deviceId = deviceRecord?.id;
    if (!deviceId) {
      const created = await this.prisma.device.create({
        data: {
          id: crypto.randomUUID(),
          userId: user.id,
          deviceFingerprint: device.fingerprint,
          platform: device.platform as DevicePlatform,
          model: device.model ?? null,
          osVersion: device.osVersion ?? null,
          appVersion: device.appVersion ?? null,
          lastSeenAt: new Date(),
        },
      });
      deviceId = created.id;
    }

    // ── Issue tokens ──
    const { sessionId, rawRefreshToken } = await this.sessionService.createSession(
      user.id,
      deviceId,
      ip,
      userAgent,
    );
    const accessToken = this.tokenService.signAccessToken({
      sub: user.id,
      role: user.role,
      merchantId: undefined,
      sid: sessionId,
      did: deviceId,
    });

    this.audit.log({
      actorType: 'USER',
      actorUserId: user.id,
      action: 'auth.google.onboard.success',
      targetType: 'user',
      targetId: user.id,
      ip,
      userAgent,
      metadata: {
        email: decoded.email,
        phone: normalizedPhone,
        deviceId,
        deviceFingerprint: device.fingerprint,
      },
    });

    return {
      ok: true,
      user: {
        id: user.id,
        phone: user.phone,
        fullName: user.fullName,
        googleUid: user.googleUid!,
        googleEmail: user.googleEmail!,
      },
      accessToken,
      refreshToken: rawRefreshToken,
      needsOnboarding: true,
    };
  }

  /**
   * Returning Google user sign-in.
   * Public endpoint. Checks device limit, issues tokens.
   */
  async signin(dto: {
    idToken: string;
    device: {
      fingerprint: string;
      platform: 'ANDROID' | 'IOS';
      model?: string;
      osVersion?: string;
      appVersion?: string;
    };
    ip?: string;
    userAgent?: string;
  }): Promise<SigninResult> {
    const { idToken, device, ip, userAgent } = dto;

    // Rate limit: 10 per IP per hour
    if (ip) {
      const key = `google-signin:ip:${ip}`;
      const count = await this.redis.incr(key, RATE_LIMIT_TTL_SECONDS);
      if (count > ONBOARD_RATE_LIMIT_MAX) {
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
        action: 'auth.google.signin.fail',
        targetType: 'user',
        targetId: user.id,
        ip,
        userAgent,
        metadata: { reason: 'banned', email: decoded.email },
      });
      throw new Error('account banned');
    }

    // ── Device constraint ──
    const existingPair = await this.prisma.userDevice.findUnique({
      where: {
        userId_deviceFingerprint: {
          userId: user.id,
          deviceFingerprint: device.fingerprint,
        },
      },
    });

    if (existingPair) {
      // Device already paired to this user — update last active
      await this.prisma.userDevice.update({
        where: { id: existingPair.id },
        data: { lastActiveAt: new Date() },
      });
    } else {
      // New device for this user — check device-level limit
      const devicePairCount = await this.prisma.userDevice.count({
        where: { deviceFingerprint: device.fingerprint },
      });
      if (devicePairCount >= 2) {
        const existingPairs = await this.prisma.userDevice.findMany({
          where: { deviceFingerprint: device.fingerprint },
          include: { user: { select: { phone: true } } },
        });
        const existingPhones = existingPairs
          .map((p) => p.user.phone)
          .filter((p): p is string => !!p)
          .map((p) => this.maskPhone(p));
        this.audit.log({
          actorType: 'SYSTEM',
          action: 'auth.google.signin.device_limit',
          targetType: 'device',
          targetId: device.fingerprint,
          ip,
          userAgent,
          metadata: { existingPhones, googleEmail: decoded.email },
        });
        throw new DeviceLimitPairsError(existingPhones);
      }

      // Create user-device pairing
      await this.prisma.userDevice.create({
        data: {
          id: crypto.randomUUID(),
          userId: user.id,
          deviceFingerprint: device.fingerprint,
          lastActiveAt: new Date(),
        },
      });

      // Ensure a Device row exists for session FK
      const deviceRecord = await this.prisma.device.findFirst({
        where: {
          userId: user.id,
          deviceFingerprint: device.fingerprint,
        },
      });
      if (!deviceRecord) {
        await this.prisma.device.create({
          data: {
            id: crypto.randomUUID(),
            userId: user.id,
            deviceFingerprint: device.fingerprint,
            platform: device.platform as DevicePlatform,
            model: device.model ?? null,
            osVersion: device.osVersion ?? null,
            appVersion: device.appVersion ?? null,
            lastSeenAt: new Date(),
          },
        });
      }
    }

    // ── Issue tokens ──
    const deviceRecord = await this.prisma.device.findFirst({
      where: {
        userId: user.id,
        deviceFingerprint: device.fingerprint,
      },
    });
    const deviceId = deviceRecord!.id;

    const { sessionId, rawRefreshToken } = await this.sessionService.createSession(
      user.id,
      deviceId,
      ip,
      userAgent,
    );
    const accessToken = this.tokenService.signAccessToken({
      sub: user.id,
      role: user.role,
      merchantId: undefined,
      sid: sessionId,
      did: deviceId,
    });

    this.audit.log({
      actorType: 'USER',
      actorUserId: user.id,
      action: 'auth.google.signin.success',
      targetType: 'user',
      targetId: user.id,
      ip,
      userAgent,
      metadata: {
        email: decoded.email,
        deviceId,
        deviceFingerprint: device.fingerprint,
      },
    });

    return {
      ok: true,
      user: {
        id: user.id,
        phone: user.phone,
        fullName: user.fullName,
        googleUid: user.googleUid!,
        googleEmail: user.googleEmail!,
      },
      accessToken,
      refreshToken: rawRefreshToken,
      needsOnboarding: false,
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

  /**
   * List accounts paired to a device fingerprint (public, pre-sign-in).
   */
  async getDeviceAccounts(deviceFingerprint: string): Promise<{ accounts: DeviceAccount[] }> {
    const pairs = await this.prisma.userDevice.findMany({
      where: { deviceFingerprint },
      include: {
        user: {
          select: { phone: true, googleEmail: true },
        },
      },
      orderBy: { pairedAt: 'desc' },
    });

    const accounts = pairs.map((p) => ({
      phoneLast4: this.maskPhone(p.user.phone),
      googleEmail: p.user.googleEmail ?? '',
    }));

    return { accounts };
  }

  /**
   * Remove a device binding for a specific account (public).
   * Looks up the user by phone's last 4 digits, then deletes the
   * user_devices row matching (deviceFingerprint, userId).
   */
  async signoutDeviceAccount(dto: {
    phoneLast4: string;
    deviceFingerprint: string;
  }): Promise<void> {
    const { phoneLast4, deviceFingerprint } = dto;

    // Find users whose phone ends with the given last-4 digits
    const users = await this.prisma.user.findMany({
      where: {
        phone: { endsWith: phoneLast4 },
        phonePairedAt: { not: null },
      },
      select: { id: true, phone: true },
    });

    const matchingUser = users.find((u) => u.phone.endsWith(phoneLast4));

    if (!matchingUser) {
      return; // No binding to remove — idempotent
    }

    await this.prisma.userDevice.deleteMany({
      where: {
        userId: matchingUser.id,
        deviceFingerprint,
      },
    });

    this.audit.log({
      actorType: 'USER',
      actorUserId: matchingUser.id,
      action: 'auth.device.unpaired',
      targetType: 'user_device',
      targetId: matchingUser.id,
      metadata: { deviceFingerprint },
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private normalizePhone(phone: string): string {
    const stripped = phone.replace(/[\s\-]/g, '');
    if (!stripped.startsWith('+251')) {
      throw new PhoneInvalidFormatError();
    }
    if (!ETHIOPIAN_PHONE_REGEX.test(stripped)) {
      throw new PhoneInvalidFormatError();
    }
    return stripped;
  }

  private maskPhone(phone: string): string {
    if (!phone || phone.length < 4) return phone;
    return `+2519****${phone.slice(-4)}`;
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
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      default:
        return 15 * 60 * 1000;
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
