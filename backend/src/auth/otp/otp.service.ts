// ============================================================
// Yene Verify — OTP Service
// Handles OTP generation, delivery, and verification.
// ============================================================

import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomInt } from 'crypto';
import * as bcrypt from 'bcrypt';
import { AppConfigService } from '../../config/config.service';
import { OtpRepository } from './otp.repository';
import { OtpSender } from './otp.sender';
import { OtpRateLimiter } from './otp.rate-limiter';
import { InvalidOtpError, OtpExpiredError, OtpMaxAttemptsError } from '../errors';
import { OtpPurpose } from '../constants';

export interface RequestOtpResult {
  ok: true;
  expiresInSeconds: number;
}

export interface VerifyOtpResult {
  userId: string;
  isNewUser: boolean;
  needsPinSetup: boolean;
  needsOnboarding: boolean;
}

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly repo: OtpRepository,
    @Inject('OtpSender') private readonly sender: OtpSender,
    private readonly rateLimiter: OtpRateLimiter,
  ) {}

  /**
   * Request an OTP for the given phone and purpose.
   */
  async requestOtp(
    phone: string,
    purpose: OtpPurpose,
    ip: string,
    userAgent: string | undefined,
  ): Promise<RequestOtpResult> {
    // Enforce rate limits
    await this.rateLimiter.enforce(phone, ip, purpose);

    // Generate 6-digit code
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const codeHash = await bcrypt.hash(code, this.config.otp.hashRounds);

    const expiresAt = new Date(Date.now() + this.config.otp.ttlSeconds * 1000);

    // Create OTP record
    await this.repo.create({
      id: crypto.randomUUID(),
      phone,
      purpose,
      codeHash,
      maxAttempts: this.config.otp.maxAttempts,
      expiresAt,
      ip,
      userAgent,
    });

    // Send via provider
    await this.sender.send(phone, code, purpose);

    // Audit log
    this.logger.log({
      event: 'otp.requested',
      phone: this.maskPhone(phone),
      purpose,
      ip: this.maskIp(ip),
    });

    return { ok: true, expiresInSeconds: this.config.otp.ttlSeconds };
  }

  /**
   * Verify an OTP code.
   */
  async verifyOtp(
    phone: string,
    code: string,
    purpose: OtpPurpose,
    _ip: string,
    _userAgent: string | undefined,
  ): Promise<VerifyOtpResult> {
    const record = await this.repo.findLatestActive(phone, purpose);

    if (!record) {
      this.logger.warn({
        event: 'otp.verify.failed',
        phone: this.maskPhone(phone),
        purpose,
        reason: 'not_found_or_expired',
      });
      throw new OtpExpiredError();
    }

    // Check attempt limit
    if (record.attempts >= record.maxAttempts) {
      await this.repo.markConsumed(record.id);
      this.logger.warn({
        event: 'otp.verify.locked',
        phone: this.maskPhone(phone),
        purpose,
        attempts: record.attempts,
      });
      throw new OtpMaxAttemptsError(this.config.otp.lockoutSeconds);
    }

    // Verify code
    const isValid = await bcrypt.compare(code, record.codeHash);

    if (!isValid) {
      await this.repo.incrementAttempts(record.id);
      this.logger.warn({
        event: 'otp.verify.failed',
        phone: this.maskPhone(phone),
        purpose,
        attempts: record.attempts + 1,
      });
      throw new InvalidOtpError();
    }

    // Success - mark consumed
    await this.repo.markConsumed(record.id);

    this.logger.log({
      event: 'otp.verified',
      phone: this.maskPhone(phone),
      purpose,
    });

    // The actual user resolution happens in AuthService
    return { userId: '', isNewUser: false, needsPinSetup: false, needsOnboarding: false };
  }

  private maskPhone(phone: string): string {
    if (phone.startsWith('+251') && phone.length === 13) {
      return `+2519*****${phone.slice(-2)}`;
    }
    return phone;
  }

  private maskIp(ip: string): string {
    const parts = ip.split('.');
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.*.*`;
    if (ip.includes(':')) {
      const parts = ip.split(':');
      if (parts.length >= 2) return `${parts.slice(0, -2).join(':')}::*`;
    }
    return ip;
  }
}
