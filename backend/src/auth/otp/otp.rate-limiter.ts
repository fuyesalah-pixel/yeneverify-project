// ============================================================
// Yene Verify — OTP Rate Limiter
// Redis-based rate limiting for OTP requests.
// ============================================================

import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../../config/config.service';
import { RedisService } from '../../redis/redis.service';
import { OtpRateLimitedError } from '../errors';

interface RateLimitConfig {
  key: string;
  limit: number;
  ttlSeconds: number;
  errorMessage: string;
}

/**
 * OTP rate limiter using Redis INCR with TTL.
 * Enforces limits per phone, per IP, and per phone+purpose.
 */
@Injectable()
export class OtpRateLimiter {
  private readonly logger = new Logger(OtpRateLimiter.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Check and increment rate limit for OTP request.
   * Throws OtpRateLimitedError if any limit is exceeded.
   */
  async enforce(phone: string, ip: string, purpose: string): Promise<void> {
    const constants = this.getConstants();
    const phoneKey = this.normalizePhone(phone);

    const checks: RateLimitConfig[] = [
      {
        key: `otp:phone:${phoneKey}`,
        limit: constants.otpRatePhoneHourly,
        ttlSeconds: 3600,
        errorMessage: 'Too many OTP requests from this phone number.',
      },
      {
        key: `otp:ip:${ip}`,
        limit: constants.otpRateIpHourly,
        ttlSeconds: 3600,
        errorMessage: 'Too many OTP requests from this IP address.',
      },
      {
        key: `otp:phone-purpose:${phoneKey}:${purpose}`,
        limit: constants.otpRatePhonePurpose5Min,
        ttlSeconds: 300,
        errorMessage: 'Too many OTP requests for this purpose.',
      },
    ];

    for (const check of checks) {
      const current = await this.redisService.incr(check.key, check.ttlSeconds);
      if (current > check.limit) {
        this.logger.warn({
          event: 'otp.rate_limited',
          phone: this.maskPhone(phone),
          ip: this.maskIp(ip),
          purpose,
          limit: check.limit,
          current,
          window: check.ttlSeconds,
        });
        throw new OtpRateLimitedError(check.ttlSeconds);
      }
    }
  }

  /** Get rate limit constants from config. */
  private getConstants() {
    return {
      otpRatePhoneHourly: this.config.throttle.otpLimit * 12, // 5/min -> 60/5min
      otpRateIpHourly: 20,
      otpRatePhonePurpose5Min: 3,
    };
  }

  private maskPhone(phone: string): string {
    if (phone.startsWith('+251') && phone.length === 13) {
      return `+2519*****${phone.slice(-2)}`;
    }
    return phone;
  }

  private maskIp(ip: string): string {
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.*.*`;
    }
    if (ip.includes(':')) {
      // IPv6 - mask last 2 segments
      const parts = ip.split(':');
      if (parts.length >= 2) {
        return `${parts.slice(0, -2).join(':')}::*`;
      }
    }
    return ip;
  }

  private normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '').replace(/^251/, '').replace(/^0/, '');
  }
}
