// ============================================================
// Yene Verify — Token Repository
// Thin Prisma wrapper for session operations.
// ============================================================

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export interface SessionRecord {
  id: string;
  userId: string;
  deviceId: string;
  refreshTokenHash: string;
  ip: string | null;
  userAgent: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class TokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new session.
   */
  async create(data: {
    id: string;
    userId: string;
    deviceId: string;
    refreshTokenHash: string;
    ip?: string;
    userAgent?: string;
    expiresAt: Date;
  }): Promise<SessionRecord> {
    return this.prisma.session.create({
      data: {
        id: data.id,
        userId: data.userId,
        deviceId: data.deviceId,
        refreshTokenHash: data.refreshTokenHash,
        ip: data.ip,
        userAgent: data.userAgent,
        expiresAt: data.expiresAt,
      },
    });
  }

  /**
   * Find session by refresh token hash.
   */
  async findByRefreshHash(hash: string): Promise<SessionRecord | null> {
    return this.prisma.session.findUnique({
      where: { refreshTokenHash: hash },
      include: {
        user: {
          select: { id: true, role: true, status: true, ownedMerchant: { select: { id: true } } },
        },
        device: {
          select: { id: true, revokedAt: true },
        },
      },
    }) as Promise<SessionRecord | null>;
  }

  /**
   * Revoke a session.
   */
  async revoke(sessionId: string): Promise<SessionRecord> {
    return this.prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Revoke all sessions for a user.
   */
  async revokeAllForUser(userId: string): Promise<Prisma.BatchPayload> {
    return this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Update last used timestamp.
   */
  async touchLastUsed(sessionId: string): Promise<SessionRecord> {
    return this.prisma.session.update({
      where: { id: sessionId },
      data: { lastUsedAt: new Date() },
    });
  }

  /**
   * Prune old sessions.
   */
  async pruneOld(cutoff: Date): Promise<Prisma.BatchPayload> {
    return this.prisma.session.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: cutoff } }, { revokedAt: { lt: cutoff } }],
      },
    });
  }
}
