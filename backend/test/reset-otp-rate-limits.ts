// ============================================================
// Yene Verify — E2E helper: reset OTP rate-limit counters
//
// The OTP rate limiter (src/auth/otp/otp.rate-limiter.ts) keeps
// REDIS-backed per-phone / per-IP / per-purpose counters with hourly
// and 5-minute windows. E2E suites that authenticate via the real OTP
// flow therefore carry cross-run state: after enough suite runs (or a
// parallel suite fan-out) the shared `otp:ip:<ip>` counter exceeds its
// hourly budget and every request-otp call in the suite starts
// returning 429 — a test-infrastructure failure, not a product bug.
//
// resetOtpRateLimits(app) deletes ONLY keys matching `<prefix>otp:*`
// (counters, not live OTP codes), making the suites repeat-run safe —
// the same treatment the credits suites got for the append-only
// ledger in 14.1.
//
// ioredis auto-applies the configured keyPrefix to DEL key arguments
// but not to SCAN match patterns, so we scan with the prefix baked in
// and strip it again before deleting.
// ============================================================

import type { INestApplication } from '@nestjs/common';
import { AppConfigService } from '../src/config/config.service';
import { RedisService } from '../src/redis/redis.service';

export async function resetOtpRateLimits(app: INestApplication): Promise<void> {
  const redis = app.get(RedisService);
  const prefix = app.get(AppConfigService).redis.prefix;
  const client = redis.raw;
  if (!client) return;

  let cursor = '0';
  const unprefixed: string[] = [];
  do {
    const [next, keys] = await client.scan(cursor, 'MATCH', `${prefix}otp:*`, 'COUNT', 500);
    cursor = next;
    for (const key of keys as string[]) {
      unprefixed.push(key.startsWith(prefix) ? key.slice(prefix.length) : key);
    }
  } while (cursor !== '0');

  // DEL each through the client so the keyPrefix is applied exactly once.
  for (const key of unprefixed) {
    await redis.del(key);
  }
}
