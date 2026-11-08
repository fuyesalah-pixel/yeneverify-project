// ============================================================
// Yene Verify â€” Waitlist Service
// POST /api/v1/waitlist business logic.
// Rate limit: 5 submissions per IP per hour (Redis counter).
// Duplicate emails are handled idempotently (200, already registered).
// ============================================================

import { Injectable } from '@nestjs/common';
import { AppError } from '../common/errors/app-error';
import { ERROR_CODES } from '../common/constants/error-codes';
import { RedisService } from '../redis/redis.service';
import { WaitlistRepository } from './waitlist.repository';

const RATE_LIMIT_TTL_SECONDS = 60 * 60; // 1 hour
const RATE_LIMIT_MAX = 5;

@Injectable()
export class WaitlistService {
  constructor(
    private readonly repo: WaitlistRepository,
    private readonly redis: RedisService,
  ) {}

  async subscribe(dto: { email: string; source?: string; ip?: string }) {
    const { email, source, ip } = dto;

    // Rate limit: 5 per IP per hour
    if (ip) {
      const key = `waitlist:ip:${ip}`;
      const count = await this.redis.incr(key, RATE_LIMIT_TTL_SECONDS);
      if (count > RATE_LIMIT_MAX) {
        throw new AppError(
          ERROR_CODES.RATE_LIMITED,
          'Too many waitlist submissions. Please try again later.',
          429,
        );
      }
    }

    // Idempotent: if email already registered, treat as already subscribed (200).
    const existing = await this.repo.findByEmail(email);
    if (existing) {
      return { ok: true, created: false };
    }

    await this.repo.create({ email, source, ip });
    return { ok: true, created: true };
  }
}
