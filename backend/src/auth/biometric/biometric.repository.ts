// ============================================================
// Yene Verify — Biometric Repository
// ============================================================

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BiometricRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Enable biometric for a specific device.
   */
  async enableForDevice(userId: string, deviceId: string) {
    return this.prisma.device.update({
      where: { id: deviceId, userId },
      data: { biometricEnabled: true },
    });
  }

  /**
   * Disable biometric for a specific device.
   */
  async disableForDevice(userId: string, deviceId: string) {
    return this.prisma.device.update({
      where: { id: deviceId, userId },
      data: { biometricEnabled: false },
    });
  }

  /**
   * Check if user has any device with biometric enabled.
   */
  async hasAnyBiometricEnabled(userId: string): Promise<boolean> {
    const count = await this.prisma.device.count({
      where: { userId, biometricEnabled: true, revokedAt: null },
    });
    return count > 0;
  }

  /**
   * Enable/disable biometric at user level.
   */
  async setUserBiometricEnabled(userId: string, enabled: boolean) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        biometricEnabled: enabled,
        biometricEnabledAt: enabled ? new Date() : null,
      },
    });
  }

  /**
   * Get user's biometric status.
   */
  async getUserBiometricStatus(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { biometricEnabled: true, biometricEnabledAt: true },
    });
  }
}
