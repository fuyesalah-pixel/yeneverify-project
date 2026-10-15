// ============================================================
// Yene Verify — Biometric Service
// Handles biometric enable/disable.
// ============================================================

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class BiometricService {
  private readonly logger = new Logger(BiometricService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Enable biometric unlock for a device.
   * Requires step-up (PIN verify).
   */
  async enableBiometric(
    userId: string,
    deviceId: string,
    ip: string,
    _userAgent: string | undefined,
  ): Promise<{ ok: true }> {
    // Verify device belongs to user
    const device = await this.prisma.device.findFirst({
      where: { id: deviceId, userId },
    });
    if (!device) throw new Error('Device not found');

    // Enable biometric on device
    await this.prisma.device.update({
      where: { id: deviceId },
      data: { biometricEnabled: true },
    });

    // Check if user now has any biometric-enabled devices
    const hasEnabled = await this.prisma.device.count({
      where: { userId, biometricEnabled: true, revokedAt: null },
    });

    if (hasEnabled > 0) {
      // Update user-level flag
      await this.prisma.user.update({
        where: { id: userId },
        data: { biometricEnabled: true, biometricEnabledAt: new Date() },
      });
    }

    this.audit.log({
      actorType: 'USER',
      actorUserId: userId,
      action: 'auth.biometric.enable',
      targetType: 'device',
      targetId: deviceId,
      ip,
      metadata: { deviceFingerprint: '' }, // not logged for privacy
    });

    this.logger.log({ event: 'auth.biometric.enable', userId, deviceId });
    return { ok: true };
  }

  /**
   * Disable biometric unlock for a device.
   */
  async disableBiometric(
    userId: string,
    deviceId: string,
    ip: string,
    _userAgent: string | undefined,
  ): Promise<{ ok: true }> {
    // Verify device belongs to user
    const device = await this.prisma.device.findFirst({
      where: { id: deviceId, userId },
    });
    if (!device) throw new Error('Device not found');

    // Disable biometric on device
    await this.prisma.device.update({
      where: { id: deviceId },
      data: { biometricEnabled: false },
    });

    // Check if user still has any biometric-enabled devices
    const enabledCount = await this.prisma.device.count({
      where: { userId, biometricEnabled: true, revokedAt: null },
    });

    if (enabledCount === 0) {
      // Disable user-level flag
      await this.prisma.user.update({
        where: { id: userId },
        data: { biometricEnabled: false, biometricEnabledAt: null },
      });
    }

    this.audit.log({
      actorType: 'USER',
      actorUserId: userId,
      action: 'auth.biometric.disable',
      targetType: 'device',
      targetId: deviceId,
      ip,
      metadata: {},
    });

    this.logger.log({ event: 'auth.biometric.disable', userId, deviceId });
    return { ok: true };
  }

  /**
   * Get biometric status for user.
   */
  async getBiometricStatus(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { biometricEnabled: true, biometricEnabledAt: true },
    });
  }
}
