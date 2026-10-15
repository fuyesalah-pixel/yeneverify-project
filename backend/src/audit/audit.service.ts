// ============================================================
// Yene Verify — Audit Service
// Centralized audit logging. Fire-and-forget, never blocks requests.
// ============================================================

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { redactSensitiveData } from '../common/logger/redact';

export interface AuditEntry {
  actorType: 'USER' | 'SYSTEM' | 'ADMIN';
  actorUserId?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  ip?: string;
  userAgent?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Log an audit event. Fire-and-forget - never throws.
   */
  log(entry: AuditEntry): void {
    // Run in background, never block the request
    this.writeAudit(entry).catch((err) => {
      this.logger.error({
        event: 'audit.write.failed',
        error: err.message,
        action: entry.action,
      });
    });
  }

  /**
   * Internal write method. Separated for testing.
   */
  private async writeAudit(entry: AuditEntry): Promise<void> {
    const sanitized = redactSensitiveData(entry, [
      // Add any additional secret values here if needed
    ]);

    await this.prisma.auditLog.create({
      data: {
        id: crypto.randomUUID(),
        actorType: sanitized.actorType as Prisma.AuditLogCreateInput['actorType'],
        actorUserId: sanitized.actorUserId,
        merchantId: sanitized.metadata?.merchantId as string | undefined,
        action: sanitized.action,
        targetType: sanitized.targetType,
        targetId: sanitized.targetId,
        ip: sanitized.ip,
        userAgent: sanitized.userAgent,
        requestId: sanitized.requestId,
        metadata: sanitized.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  /**
   * Query audit logs (for admin/debugging).
   */
  async findMany(params: {
    merchantId?: string;
    actorUserId?: string;
    action?: string;
    from?: Date;
    to?: Date;
    limit?: number;
    offset?: number;
  }) {
    const { merchantId, actorUserId, action, from, to, limit = 100, offset = 0 } = params;

    return this.prisma.auditLog.findMany({
      where: {
        ...(merchantId && { merchantId }),
        ...(actorUserId && { actorUserId }),
        ...(action && { action: { contains: action, mode: 'insensitive' } }),
        ...(from && to && { createdAt: { gte: from, lte: to } }),
        ...(from && !to && { createdAt: { gte: from } }),
        ...(!from && to && { createdAt: { lte: to } }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }
}
