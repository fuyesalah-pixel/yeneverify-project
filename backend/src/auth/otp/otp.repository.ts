// ============================================================
// Yene Verify — OTP Repository
// Thin Prisma wrapper for OTP code operations.
// ============================================================

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { OtpPurpose } from '@prisma/client';

export interface OtpCodeRecord {
  id: string;
  phone: string;
  purpose: string;
  codeHash: string;
  attempts: number;
  maxAttempts: number;
  expiresAt: Date;
  consumedAt: Date | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
}

@Injectable()
export class OtpRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new OTP code record.
   */
  async create(data: {
    id: string;
    phone: string;
    purpose: string;
    codeHash: string;
    maxAttempts: number;
    expiresAt: Date;
    ip?: string;
    userAgent?: string;
  }): Promise<OtpCodeRecord> {
    return this.prisma.otpCode.create({
      data: {
        id: data.id,
        phone: data.phone,
        purpose: data.purpose as OtpPurpose,
        codeHash: data.codeHash,
        maxAttempts: data.maxAttempts,
        expiresAt: data.expiresAt,
        ip: data.ip,
        userAgent: data.userAgent,
      },
    });
  }

  /**
   * Find the latest non-consumed, non-expired OTP for a phone and purpose.
   */
  async findLatestActive(phone: string, purpose: string): Promise<OtpCodeRecord | null> {
    return this.prisma.otpCode.findFirst({
      where: {
        phone,
        purpose: purpose as OtpPurpose,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Increment attempt count.
   */
  async incrementAttempts(id: string): Promise<OtpCodeRecord> {
    return this.prisma.otpCode.update({
      where: { id },
      data: { attempts: { increment: 1 } },
    });
  }

  /**
   * Mark OTP as consumed.
   */
  async markConsumed(id: string): Promise<OtpCodeRecord> {
    return this.prisma.otpCode.update({
      where: { id },
      data: { consumedAt: new Date() },
    });
  }

  /**
   * Purge expired OTP codes (older than 24 hours).
   * Called by scheduled job.
   */
  async purgeExpired(): Promise<Prisma.BatchPayload> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return this.prisma.otpCode.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: cutoff } }, { consumedAt: { lt: cutoff } }],
      },
    });
  }

  /**
   * Delete all OTP codes for a phone (used on successful verification).
   */
  async deleteByPhone(phone: string): Promise<Prisma.BatchPayload> {
    return this.prisma.otpCode.deleteMany({ where: { phone } });
  }
}
