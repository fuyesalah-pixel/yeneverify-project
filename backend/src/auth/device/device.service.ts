// ============================================================
// Yene Verify — Device Service
// Manages device binding, listing, and revocation.
// ============================================================

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionService } from '../session/session.service';
import { DeviceLimitExceededError, DeviceRevokedError } from '../errors';
import { DevicePlatform } from '@prisma/client';

export interface DeviceInfo {
  id: string;
  fingerprint: string;
  platform: DevicePlatform;
  model: string | null;
  osVersion: string | null;
  appVersion: string | null;
  pushToken: string | null;
  lastSeenAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class DeviceService {
  private readonly logger = new Logger(DeviceService.name);
  private readonly maxActiveDevices = 3;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionService: SessionService,
  ) {}

  /**
   * Resolve an existing device by fingerprint or create a new one.
   * Enforces the max active devices limit.
   */
  async resolveOrCreate(
    userId: string,
    fingerprint: string,
    platform: DevicePlatform,
    model?: string,
    osVersion?: string,
    appVersion?: string,
    pushToken?: string,
  ): Promise<DeviceInfo> {
    // Check for existing device with same fingerprint
    const existing = await this.prisma.device.findUnique({
      where: { userId_deviceFingerprint: { userId, deviceFingerprint: fingerprint } },
    });

    if (existing) {
      // Update push token if provided
      if (pushToken && pushToken !== existing.pushToken) {
        await this.prisma.device.update({
          where: { id: existing.id },
          data: { pushToken, pushTokenUpdatedAt: new Date() },
        });
      }
      // Update last seen
      await this.prisma.device.update({
        where: { id: existing.id },
        data: { lastSeenAt: new Date() },
      });
      return this.toInfo(existing);
    }

    // Count active devices
    const activeCount = await this.prisma.device.count({
      where: { userId, revokedAt: null },
    });

    if (activeCount >= this.maxActiveDevices) {
      const activeDevices = await this.prisma.device.findMany({
        where: { userId, revokedAt: null },
        select: { id: true, deviceFingerprint: true },
      });
      throw new DeviceLimitExceededError(
        activeDevices.map((d) => ({ id: d.id, fingerprint: d.deviceFingerprint })),
      );
    }

    // Create new device
    const device = await this.prisma.device.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        deviceFingerprint: fingerprint,
        platform,
        model,
        osVersion,
        appVersion,
        pushToken,
      },
    });

    this.logger.log({
      event: 'auth.device.created',
      userId,
      deviceId: device.id,
      fingerprint,
    });

    return this.toInfo(device);
  }

  /**
   * List all active devices for a user.
   */
  async listActive(userId: string): Promise<DeviceInfo[]> {
    const devices = await this.prisma.device.findMany({
      where: { userId, revokedAt: null },
      orderBy: { lastSeenAt: 'desc' },
    });
    return devices.map(this.toInfo);
  }

  /**
   * Revoke a device (and all its sessions).
   */
  async revoke(userId: string, deviceId: string, reason = 'user_revoked'): Promise<void> {
    const device = await this.prisma.device.findFirst({
      where: { id: deviceId, userId },
    });

    if (!device) {
      throw new DeviceRevokedError('Device not found');
    }

    if (device.revokedAt) {
      throw new DeviceRevokedError('Device already revoked');
    }

    // Revoke device
    await this.prisma.device.update({
      where: { id: deviceId },
      data: { revokedAt: new Date() },
    });

    // Revoke all sessions for this device
    await this.sessionService.revokeForDevice(deviceId);

    this.logger.log({
      event: 'auth.device.revoked',
      userId,
      deviceId,
      fingerprint: device.deviceFingerprint,
      reason,
    });
  }

  /**
   * Update push token for a device.
   */
  async updatePushToken(userId: string, deviceId: string, pushToken: string): Promise<void> {
    await this.prisma.device.update({
      where: { id: deviceId, userId },
      data: { pushToken, pushTokenUpdatedAt: new Date() },
    });
  }

  /**
   * Check if a device is revoked.
   */
  async isRevoked(deviceId: string): Promise<boolean> {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
      select: { revokedAt: true },
    });
    return device?.revokedAt !== null;
  }

  private toInfo(device: {
    id: string;
    deviceFingerprint: string;
    platform: DevicePlatform;
    model: string | null;
    osVersion: string | null;
    appVersion: string | null;
    pushToken: string | null;
    lastSeenAt: Date | null;
    revokedAt: Date | null;
    createdAt: Date;
  }): DeviceInfo {
    return {
      id: device.id,
      fingerprint: device.deviceFingerprint,
      platform: device.platform,
      model: device.model,
      osVersion: device.osVersion,
      appVersion: device.appVersion,
      pushToken: device.pushToken,
      lastSeenAt: device.lastSeenAt,
      revokedAt: device.revokedAt,
      createdAt: device.createdAt,
    };
  }
}
