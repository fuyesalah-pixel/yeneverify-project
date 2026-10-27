// ============================================================
// Yene Verify — Session Service
// Manages session lifecycle (create, refresh, revoke, prune).
// ============================================================

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenService } from '../tokens/token.service';

export interface SessionInfo {
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
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
  ) {}

  /**
   * Create a new session for a user/device.
   */
  async create(
    userId: string,
    deviceId: string,
    refreshTokenHash: string,
    ip?: string,
    userAgent?: string,
  ): Promise<SessionInfo> {
    return this.prisma.session.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        deviceId,
        refreshTokenHash,
        ip,
        userAgent,
        expiresAt: new Date(Date.now() + this.parseTtl(this.tokenService['config'].jwt.refreshTtl)),
      },
    });
  }

  /**
   * Create a session and generate its refresh token pair.
   * Stores only sha256(raw) — the raw token is returned to the caller once,
   * to be handed to the client alongside the access token.
   */
  async createSession(
    userId: string,
    deviceId: string,
    ip?: string,
    userAgent?: string,
  ): Promise<{ sessionId: string; rawRefreshToken: string }> {
    const { raw, hash } = this.tokenService.generateRefreshToken();
    const session = await this.prisma.session.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        deviceId,
        refreshTokenHash: hash,
        ip,
        userAgent,
        expiresAt: new Date(Date.now() + this.parseTtl(this.tokenService['config'].jwt.refreshTtl)),
      },
    });
    return { sessionId: session.id, rawRefreshToken: raw };
  }

  /**
   * Find session by ID.
   */
  async findById(id: string): Promise<SessionInfo | null> {
    return this.prisma.session.findUnique({ where: { id } });
  }

  /**
   * Find session by refresh token hash.
   */
  async findByRefreshHash(hash: string): Promise<SessionInfo | null> {
    return this.prisma.session.findUnique({
      where: { refreshTokenHash: hash },
      include: {
        user: {
          select: { id: true, role: true, status: true, ownedMerchant: { select: { id: true } } },
        },
        device: { select: { id: true, revokedAt: true } },
      },
    }) as Promise<SessionInfo | null>;
  }

  /**
   * List active sessions for a user.
   */
  async listActive(userId: string): Promise<SessionInfo[]> {
    return this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: 'desc' },
    });
  }

  /**
   * Revoke a specific session.
   */
  async revoke(sessionId: string): Promise<SessionInfo> {
    return this.prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Revoke all sessions for a user.
   */
  async revokeAllForUser(userId: string, reason = 'logout_all'): Promise<number> {
    const result = await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    this.logger.log({
      event: 'auth.sessions.revoked_all',
      userId,
      count: result.count,
      reason,
    });

    return result.count;
  }

  /**
   * Revoke all sessions for a device.
   */
  async revokeForDevice(deviceId: string): Promise<number> {
    const result = await this.prisma.session.updateMany({
      where: { deviceId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count;
  }

  /**
   * Update last used timestamp.
   */
  async touchLastUsed(sessionId: string): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { lastUsedAt: new Date() },
    });
  }

  /**
   * Prune old sessions (revoked > 30 days or expired > 30 days).
   */
  async pruneOld(): Promise<number> {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const result = await this.prisma.session.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: cutoff } }, { revokedAt: { lt: cutoff } }],
      },
    });
    this.logger.log({
      event: 'auth.sessions.pruned',
      count: result.count,
    });
    return result.count;
  }

  private parseTtl(ttl: string): number {
    const match = ttl.match(/^(\d+)([smhd])$/);
    if (!match) return 30 * 24 * 60 * 60 * 1000;
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
        return 30 * 24 * 60 * 60 * 1000;
    }
  }
}
