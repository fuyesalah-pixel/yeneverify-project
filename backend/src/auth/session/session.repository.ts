// ============================================================
// Yene Verify — Session Repository
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
export class SessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    id: string;
    userId: string;
    deviceId: string;
    refreshTokenHash: string;
    ip?: string;
    userAgent?: string;
    expiresAt: Date;
  }): Promise<SessionRecord> {
    return this.prisma.session.create({ data });
  }

  async findById(id: string): Promise<SessionRecord | null> {
    return this.prisma.session.findUnique({ where: { id } });
  }

  async findByRefreshHash(hash: string): Promise<SessionRecord | null> {
    return this.prisma.session.findUnique({
      where: { refreshTokenHash: hash },
    });
  }

  async listActive(userId: string): Promise<SessionRecord[]> {
    return this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: 'desc' },
    });
  }

  async revoke(sessionId: string): Promise<SessionRecord> {
    return this.prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<Prisma.BatchPayload> {
    return this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeForDevice(deviceId: string): Promise<Prisma.BatchPayload> {
    return this.prisma.session.updateMany({
      where: { deviceId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async touchLastUsed(sessionId: string): Promise<SessionRecord> {
    return this.prisma.session.update({
      where: { id: sessionId },
      data: { lastUsedAt: new Date() },
    });
  }

  async pruneOld(cutoff: Date): Promise<Prisma.BatchPayload> {
    return this.prisma.session.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: cutoff } }, { revokedAt: { lt: cutoff } }],
      },
    });
  }
}
