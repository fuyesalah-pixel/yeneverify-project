// ============================================================
// Yene Verify — Verification Submit Rate Guard (13E.3)
//
// 60 submissions/minute per merchant (env-driven:
// VERIFICATION_SUBMIT_RATE_PER_MINUTE). Redis fixed-window counter,
// same pattern as OtpRateLimiter. Purpose-built instead of a @Throttle
// override so the key can be the merchant, not the IP.
// ============================================================

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AppConfigService } from '../../config/config.service';
import { RedisService } from '../../redis/redis.service';
import { RateLimitedError } from '../../common/errors/domain-errors';
import type { AuthUser } from '../../common/types/auth-user.type';

const WINDOW_SECONDS = 60;

@Injectable()
export class VerificationSubmitRateGuard implements CanActivate {
  constructor(
    private readonly config: AppConfigService,
    private readonly redis: RedisService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    // Keyed by merchant: an army of sub-merchant clicks counts against
    // the tenant's budget, not each user separately.
    const bucketUser = req.user?.merchantId ?? req.user?.id ?? req.ip ?? 'anonymous';
    const key = `ratelimit:verification-submit:${bucketUser}`;
    const limit = this.config.verification.submitRatePerMinute;

    const current = await this.redis.incr(key, WINDOW_SECONDS);
    if (current > limit) {
      throw new RateLimitedError(
        `Too many verification submissions. Limit is ${limit} per minute.`,
      );
    }
    return true;
  }
}
