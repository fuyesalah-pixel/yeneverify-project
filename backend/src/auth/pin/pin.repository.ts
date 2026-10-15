// ============================================================
// Yene Verify — PIN Repository
// Thin Prisma wrapper for PIN operations.
// ============================================================

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PinRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find user by ID with PIN fields.
   */
  async findById(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        pinHash: true,
        pinSetAt: true,
        pinFailedAttempts: true,
        pinLockedUntil: true,
        biometricEnabled: true,
        biometricEnabledAt: true,
        role: true,
        status: true,
      },
    });
  }

  /**
   * Find user by phone with PIN fields.
   */
  async findByPhone(phone: string) {
    return this.prisma.user.findUnique({
      where: { phone },
      select: {
        id: true,
        pinHash: true,
        pinSetAt: true,
        pinFailedAttempts: true,
        pinLockedUntil: true,
        biometricEnabled: true,
        biometricEnabledAt: true,
        role: true,
        status: true,
      },
    });
  }

  /**
   * Set PIN hash and clear failed attempts/lockout.
   */
  async setPin(userId: string, pinHash: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        pinHash,
        pinSetAt: new Date(),
        pinFailedAttempts: 0,
        pinLockedUntil: null,
      },
    });
  }

  /**
   * Increment failed attempts and set lockout if threshold reached.
   */
  async incrementFailedAttempts(userId: string, _maxAttempts: number, _lockoutSeconds: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { pinFailedAttempts: true },
    });

    if (!user) return null;

    const newAttempts = user.pinFailedAttempts + 1;
    const isLocked = newAttempts >= PIN_MAX_FAILED_ATTEMPTS;

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        pinFailedAttempts: newAttempts,
        pinLockedUntil: isLocked ? new Date(Date.now() + PIN_LOCKOUT_SECONDS * 1000) : null,
      },
    });
  }

  /**
   * Reset failed attempts and lockout on successful verify.
   */
  async resetFailedAttempts(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        pinFailedAttempts: 0,
        pinLockedUntil: null,
      },
    });
  }

  /**
   * Clear PIN (reset flow).
   */
  async clearPin(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        pinHash: null,
        pinSetAt: null,
        pinFailedAttempts: 0,
        pinLockedUntil: null,
        biometricEnabled: false,
        biometricEnabledAt: null,
      },
    });
  }

  /**
   * Update biometric enabled flag.
   */
  async setBiometricEnabled(userId: string, enabled: boolean) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        biometricEnabled: enabled,
        biometricEnabledAt: enabled ? new Date() : null,
      },
    });
  }
}

// Re-export constants for repository use
const PIN_MAX_FAILED_ATTEMPTS = 5;
const PIN_LOCKOUT_SECONDS = 15 * 60;
