// ============================================================
// Yene Verify — Auth Service
// Orchestrates the full authentication flow.
// ============================================================

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../config/config.service';
import { OtpService } from './otp/otp.service';
import { TokenService } from './tokens/token.service';
import { SessionService } from './session/session.service';
import { DeviceService } from './device/device.service';
import { AuditService } from '../audit/audit.service';
import { PinService } from './pin/pin.service';
import { BiometricService } from './biometric/biometric.service';
import { StepUpService } from './step-up/step-up.service';
import { DevicePlatform } from '@prisma/client';
import { OtpPurpose } from './constants';
import {
  AccountBannedError,
  AccountSuspendedError,
  DeviceRevokedError,
  RefreshTokenInvalidError,
} from './errors';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface UserWithRelations {
  id: string;
  phone: string;
  fullName: string;
  role: 'ADMIN' | 'MERCHANT' | 'SUB_MERCHANT';
  status: 'ACTIVE' | 'SUSPENDED' | 'BANNED' | 'DELETED';
  preferredLanguage: string;
  lastLoginAt: Date | null;
  merchant?: { id: string } | null;
  subMerchant?: { id: string; status: string } | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService,
    private readonly otpService: OtpService,
    private readonly tokenService: TokenService,
    private readonly sessionService: SessionService,
    private readonly deviceService: DeviceService,
    private readonly audit: AuditService,
    private readonly pinService: PinService,
    private readonly biometricService: BiometricService,
    private readonly stepUpService: StepUpService,
  ) {}

  /**
   * Request OTP for phone verification.
   */
  async requestOtp(
    phone: string,
    purpose: 'LOGIN' | 'DEVICE_BIND' | 'PHONE_CHANGE',
    ip: string,
    userAgent: string | undefined,
  ) {
    return this.otpService.requestOtp(phone, purpose as OtpPurpose, ip, userAgent);
  }

  /**
   * Verify OTP and issue tokens.
   */
  async verifyOtp(
    phone: string,
    code: string,
    purpose: 'LOGIN' | 'DEVICE_BIND' | 'PHONE_CHANGE',
    ip: string,
    userAgent: string | undefined,
    deviceInfo: {
      fingerprint: string;
      platform: 'ANDROID' | 'IOS';
      model?: string;
      osVersion?: string;
      appVersion?: string;
      pushToken?: string;
    },
  ): Promise<{
    tokens: AuthTokens;
    user: {
      id: string;
      phone: string;
      fullName: string;
      role: 'ADMIN' | 'MERCHANT' | 'SUB_MERCHANT';
      status: 'ACTIVE' | 'SUSPENDED' | 'BANNED' | 'DELETED';
      preferredLanguage: string;
      lastLoginAt: Date | null;
      needsPinSetup: boolean;
      needsOnboarding: boolean;
    };
    device: {
      id: string;
      fingerprint: string;
      platform: 'ANDROID' | 'IOS';
    };
  }> {
    // Verify OTP
    await this.otpService.verifyOtp(phone, code, purpose as OtpPurpose, ip, userAgent);

    // Find or create user
    let user = await this.prisma.user.findUnique({
      where: { phone },
      include: {
        ownedMerchant: { select: { id: true } },
        subMerchantProfile: { select: { id: true, status: true } },
      },
    });

    let isNewUser = false;
    if (!user) {
      // First-time user - determine role
      let role: 'ADMIN' | 'MERCHANT' | 'SUB_MERCHANT' = 'MERCHANT';
      if (phone === this.config.adminBootstrap.phone) {
        role = 'ADMIN';
      }

      // Check for pending sub-merchant invite by phone
      const pendingInvite = await this.prisma.subMerchant.findFirst({
        where: {
          user: { phone },
          status: 'INVITED',
        },
        include: { merchant: true },
      });

      if (pendingInvite) {
        role = 'SUB_MERCHANT';
      }

      user = await this.prisma.user.create({
        data: {
          id: crypto.randomUUID(),
          phone,
          phoneVerifiedAt: new Date(),
          fullName: '',
          role,
          status: 'ACTIVE',
          preferredLanguage: 'en',
        },
        include: {
          ownedMerchant: { select: { id: true } },
          subMerchantProfile: { select: { id: true, status: true } },
        },
      });
      isNewUser = true;

      this.audit.log({
        actorType: 'SYSTEM',
        action: 'auth.user.created',
        targetType: 'user',
        targetId: user.id,
        ip,
        userAgent,
        metadata: { role, phone: this.maskPhone(phone) },
      });
    } else {
      // Check user status
      if (user.status === 'BANNED') {
        this.audit.log({
          actorType: 'USER',
          actorUserId: user.id,
          action: 'auth.login.fail',
          targetType: 'user',
          targetId: user.id,
          ip,
          userAgent,
          metadata: { reason: 'banned' },
        });
        throw new AccountBannedError();
      }
      if (user.status === 'SUSPENDED') {
        this.audit.log({
          actorType: 'USER',
          actorUserId: user.id,
          action: 'auth.login.fail',
          targetType: 'user',
          targetId: user.id,
          ip,
          userAgent,
          metadata: { reason: 'suspended' },
        });
        throw new AccountSuspendedError();
      }
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Resolve device
    const device = await this.deviceService.resolveOrCreate(
      user.id,
      deviceInfo.fingerprint,
      deviceInfo.platform as DevicePlatform,
      deviceInfo.model,
      deviceInfo.osVersion,
      deviceInfo.appVersion,
      deviceInfo.pushToken,
    );

    // Check if device is revoked
    const isRevoked = await this.deviceService.isRevoked(device.id);
    if (isRevoked) {
      throw new DeviceRevokedError();
    }

    // Create the session first, then sign the access token with its real id.
    const { sessionId, rawRefreshToken } = await this.sessionService.createSession(
      user.id,
      device.id,
      ip,
      userAgent,
    );
    const accessToken = this.tokenService.signAccessToken({
      sub: user.id,
      role: user.role,
      merchantId: user.ownedMerchant?.id,
      sid: sessionId,
      did: device.id,
    });
    const refreshToken = rawRefreshToken;

    // Audit log
    this.audit.log({
      actorType: 'USER',
      actorUserId: user.id,
      action: 'auth.login.success',
      targetType: 'user',
      targetId: user.id,
      ip,
      userAgent,
      metadata: { isNewUser, deviceId: device.id },
    });

    // Determine onboarding/pin flags
    const needsPinSetup = false; // PIN setup in Step 11
    const needsOnboarding =
      (user.role === 'MERCHANT' && !user.ownedMerchant?.id) ||
      (user.role === 'SUB_MERCHANT' && user.subMerchantProfile?.status === 'INVITED');

    return {
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: this.parseTtl(this.config.jwt.accessTtl) / 1000,
      },
      user: {
        id: user.id,
        phone: user.phone,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
        preferredLanguage: user.preferredLanguage,
        lastLoginAt: user.lastLoginAt,
        needsPinSetup,
        needsOnboarding,
      },
      device: {
        id: device.id,
        fingerprint: device.fingerprint,
        platform: device.platform,
      },
    };
  }

  /**
   * Refresh access token using refresh token.
   */
  async refresh(refreshToken: string, ip: string): Promise<AuthTokens> {
    // User/device come from the validated session row inside rotateRefreshToken.
    const { accessToken, refreshToken: newRefreshToken } =
      await this.tokenService.rotateRefreshToken(refreshToken, ip);

    this.audit.log({
      actorType: 'USER',
      action: 'auth.refresh.success',
      ip,
      metadata: {},
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: this.parseTtl(this.config.jwt.accessTtl) / 1000,
    };
  }

  /**
   * Logout (revoke current session).
   */
  async logout(userId: string, refreshToken: string, ip: string): Promise<void> {
    const hash = this.tokenService.hashRefreshToken(refreshToken);
    const session = await this.sessionService.findByRefreshHash(hash);

    if (session) {
      await this.sessionService.revoke(session.id);
    }

    this.audit.log({
      actorType: 'USER',
      actorUserId: userId,
      action: 'auth.logout',
      ip,
      metadata: { sessionId: session?.id },
    });
  }

  /**
   * Logout all sessions for user.
   */
  async logoutAll(userId: string, ip: string): Promise<void> {
    await this.sessionService.revokeAllForUser(userId);

    this.audit.log({
      actorType: 'USER',
      actorUserId: userId,
      action: 'auth.logout.all',
      ip,
    });
  }

  /**
   * Get user profile (for /me endpoint).
   */
  async getMe(userId: string): Promise<UserWithRelations | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        ownedMerchant: { select: { id: true } },
        subMerchantProfile: { select: { id: true, status: true } },
      },
    }) as Promise<UserWithRelations | null>;
  }

  /**
   * Update user's preferred language.
   */
  async updateLanguage(userId: string, language: 'en' | 'am'): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { preferredLanguage: language },
    });
  }

  /**
   * List user's active devices.
   */
  async listDevices(userId: string) {
    return this.deviceService.listActive(userId);
  }

  /**
   * Revoke a device.
   */
  async revokeDevice(userId: string, deviceId: string): Promise<void> {
    await this.deviceService.revoke(userId, deviceId);
  }

  // ============================================================
  // PIN & Biometric methods (Step 11/12)
  // ============================================================

  /**
   * Set a new PIN for the user.
   * Requires either a fresh access token (< 5 min) or a valid OTP code.
   */
  async setPin(
    userId: string,
    pin: string,
    ip: string,
    userAgent: string | undefined,
    otpCode?: string,
  ): Promise<{ ok: true }> {
    return this.pinService.setPin(userId, pin, ip, userAgent, otpCode);
  }

  /**
   * Verify PIN and return step-up token.
   */
  async verifyPin(
    userId: string,
    pin: string,
    ip: string,
    userAgent: string | undefined,
    session: { sessionId: string; deviceId: string },
  ): Promise<{ stepUpToken: string; expiresIn: number }> {
    await this.pinService.verifyPin(userId, pin, ip, userAgent);
    // Generate step-up token bound to the caller's real session/device
    // (the step-up guard compares claims.sid/did against the request's auth context).
    const { stepUpToken, expiresIn } = await this.stepUpService.issueStepUpTokenPin(
      userId,
      session.sessionId,
      session.deviceId,
      ip,
    );
    return { stepUpToken, expiresIn };
  }

  /**
   * Change PIN (requires step-up).
   */
  async changePin(
    userId: string,
    currentPin: string,
    newPin: string,
    ip: string,
    userAgent: string | undefined,
  ): Promise<{ ok: true }> {
    return this.pinService.changePin(userId, currentPin, newPin, ip, userAgent);
  }

  /**
   * Reset PIN via OTP (forgot PIN flow).
   */
  async resetPin(
    phone: string,
    otpCode: string,
    ip: string,
    userAgent: string | undefined,
    deviceInfo: {
      fingerprint: string;
      platform: string;
      model?: string;
      osVersion?: string;
      appVersion?: string;
      pushToken?: string;
    },
  ): Promise<{ ok: true; requiresRelogin: true }> {
    return this.pinService.resetPin(phone, otpCode, ip, userAgent, deviceInfo);
  }

  /**
   * Enable biometric unlock for a device.
   */
  async enableBiometric(
    userId: string,
    deviceId: string,
    ip: string,
    userAgent: string | undefined,
  ): Promise<{ ok: true }> {
    return this.biometricService.enableBiometric(userId, deviceId, ip, userAgent);
  }

  /**
   * Disable biometric unlock for a device.
   */
  async disableBiometric(
    userId: string,
    deviceId: string,
    ip: string,
    userAgent: string | undefined,
  ): Promise<{ ok: true }> {
    return this.biometricService.disableBiometric(userId, deviceId, ip, userAgent);
  }

  /**
   * Get step-up token after biometric unlock.
   */
  async biometricStepUp(
    refreshToken: string,
    _fingerprint: string,
    _platform: 'ANDROID' | 'IOS',
    _model?: string,
    _osVersion?: string,
    _appVersion?: string,
    _pushToken?: string,
    ip: string = '',
  ): Promise<{ stepUpToken: string; expiresIn: number }> {
    // Derive user/session/device from the validated refresh token's session row.
    const session = await this.tokenService.validateRefreshToken(refreshToken);
    return this.stepUpService.issueStepUpTokenBiometric(
      session.userId,
      session.id,
      session.deviceId,
      ip,
    );
  }

  /**
   * Unlock session (refresh + device verification).
   * This is the mobile app's "open sesame" - called on app open after biometric/PIN gate succeeds locally.
   */
  async unlock(
    refreshToken: string,
    fingerprint: string,
    platform: 'ANDROID' | 'IOS',
    _unlockMethod: 'BIOMETRIC' | 'PIN',
    ip: string,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    // Device verification: the refresh token must belong to the device making
    // the call. A stolen refresh token replayed from another device is rejected.
    const session = await this.tokenService.validateRefreshToken(refreshToken);
    const device = session.device as { deviceFingerprint: string; platform: string };
    if (device.deviceFingerprint !== fingerprint || device.platform !== platform) {
      throw new RefreshTokenInvalidError('Refresh token does not belong to this device');
    }

    const tokens = await this.tokenService.rotateRefreshToken(refreshToken, ip);
    return {
      ...tokens,
      expiresIn: this.parseTtl(this.config.jwt.accessTtl) / 1000,
    };
  }

  private maskPhone(phone: string): string {
    if (phone.startsWith('+251') && phone.length === 13) {
      return `+2519*****${phone.slice(-2)}`;
    }
    return phone;
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
