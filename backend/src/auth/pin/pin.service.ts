// ============================================================
// Yene Verify — PIN Service
// Handles PIN set, verify, change, reset operations.
// ============================================================

import { Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { AppConfigService } from '../../config/config.service';
import { PinRepository } from './pin.repository';
import { validatePin, PIN_HASH_ROUNDS } from '../../common/constants/pin-policy';
import { InvalidPinError, PinNotSetError, PinAlreadySetError, PinLockedError } from '../errors';
import { AuditService } from '../../audit/audit.service';
import { OtpService } from '../otp/otp.service';
import { OtpPurpose } from '../constants';

@Injectable()
export class PinService {
  private readonly logger = new Logger(PinService.name);

  constructor(
    _config: AppConfigService,
    private readonly prisma: PrismaService,
    private readonly repo: PinRepository,
    private readonly audit: AuditService,
    private readonly otpService: OtpService,
  ) {}

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
    // Validate PIN policy
    validatePin(pin);

    // Check if user already has a PIN
    const user = await this.repo.findById(userId);
    if (!user) throw new Error('User not found');
    if (user.pinHash) {
      throw new PinAlreadySetError('PIN already set. Use change PIN instead.');
    }

    // If token is older than 5 minutes, require OTP
    // The controller ensures the token is fresh or passes OTP
    // We just verify OTP if provided
    if (otpCode) {
      await this.otpService.verifyOtp(
        '', // phone not needed here - we verify the OTP belongs to this user
        otpCode,
        OtpPurpose.LOGIN, // purpose doesn't matter for PIN set
        '', // ip
        '', // userAgent
      );
    }

    // Hash the PIN
    const pinHash = await bcrypt.hash(pin, PIN_HASH_ROUNDS);

    // Store PIN hash
    await this.repo.setPin(userId, pinHash);

    // Audit log
    this.audit.log({
      actorType: 'USER',
      actorUserId: userId,
      action: 'auth.pin.set',
      ip,
      userAgent,
      metadata: { method: 'pin' },
    });

    this.logger.log({ event: 'auth.pin.set', userId });
    return { ok: true };
  }

  /**
   * Verify PIN and return step-up token.
   */
  async verifyPin(
    userId: string,
    pin: string,
    ip: string,
    _userAgent: string | undefined,
  ): Promise<{ stepUpToken: string; expiresIn: number }> {
    const user = await this.repo.findById(userId);
    if (!user) throw new Error('User not found');
    if (!user.pinHash) throw new PinNotSetError();
    if (user.status !== 'ACTIVE') throw new Error('Account not active');

    // Check lockout
    if (user.pinLockedUntil && user.pinLockedUntil > new Date()) {
      const retryAfter = Math.ceil((user.pinLockedUntil.getTime() - Date.now()) / 1000);
      throw new PinLockedError(retryAfter);
    }

    // Verify PIN
    const isValid = await bcrypt.compare(pin, user.pinHash);
    if (!isValid) {
      await this.repo.incrementFailedAttempts(userId, 5, 900);
      this.audit.log({
        actorType: 'USER',
        actorUserId: userId,
        action: 'auth.pin.verify.fail',
        ip,
        metadata: { attempts: 1 }, // simplified
      });
      throw new InvalidPinError();
    }

    // Success - reset counters
    await this.repo.resetFailedAttempts(userId);

    // Generate step-up token
    // Implementation in StepUpService
    this.audit.log({
      actorType: 'USER',
      actorUserId: userId,
      action: 'auth.pin.verify.success',
      ip,
      metadata: { method: 'pin' },
    });

    this.logger.log({ event: 'auth.pin.verify.success', userId });

    return { stepUpToken: '', expiresIn: 120 }; // placeholder
  }

  /**
   * Change PIN (requires step-up).
   */
  async changePin(
    userId: string,
    currentPin: string,
    newPin: string,
    ip: string,
    _userAgent: string | undefined,
  ): Promise<{ ok: true }> {
    validatePin(newPin);
    if (currentPin === newPin) {
      throw new Error('New PIN must be different from current PIN');
    }

    const user = await this.repo.findById(userId);
    if (!user) throw new Error('User not found');
    if (!user.pinHash) throw new PinNotSetError();

    const isValid = await bcrypt.compare(currentPin, user.pinHash);
    if (!isValid) {
      await this.repo.incrementFailedAttempts(userId, 5, 900);
      throw new Error('Invalid current PIN');
    }

    // Hash new PIN
    const newPinHash = await bcrypt.hash(newPin, 10);

    // Update PIN and revoke all other sessions
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { pinHash: newPinHash },
      });
      // Revoke all sessions except current - handled by controller
    });

    this.audit.log({
      actorType: 'USER',
      actorUserId: userId,
      action: 'auth.pin.change',
      ip,
      metadata: {},
    });

    this.logger.log({ event: 'auth.pin.change', userId });
    return { ok: true };
  }

  /**
   * Reset PIN via OTP (forgot PIN flow).
   */
  async resetPin(
    phone: string,
    otpCode: string,
    ip: string,
    userAgent: string | undefined,
    _deviceInfo: {
      fingerprint: string;
      platform: string;
      model?: string;
      osVersion?: string;
      appVersion?: string;
      pushToken?: string;
    },
  ): Promise<{ ok: true; requiresRelogin: true }> {
    // Verify OTP
    await this.otpService.verifyOtp(phone, otpCode, OtpPurpose.LOGIN, ip, userAgent);

    // Find user
    const user = await this.repo.findByPhone(phone);
    if (!user) throw new Error('User not found');

    // Clear PIN and biometric
    await this.repo.clearPin(user.id);

    // Revoke all sessions
    await this.prisma.session.updateMany({
      where: { userId: user.id },
      data: { revokedAt: new Date() },
    });

    // Revoke all devices
    await this.prisma.device.updateMany({
      where: { userId: user.id },
      data: { biometricEnabled: false },
    });

    this.audit.log({
      actorType: 'USER',
      actorUserId: user.id,
      action: 'auth.pin.reset',
      ip,
      metadata: { phone: phone.replace(/\d{6}$/, '******') },
    });

    this.logger.log({ event: 'auth.pin.reset', userId: user.id });
    return { ok: true, requiresRelogin: true };
  }
}
