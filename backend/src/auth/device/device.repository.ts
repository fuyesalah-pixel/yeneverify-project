// ============================================================
// Yene Verify — Device Repository
// Thin Prisma wrapper for device operations.
// ============================================================

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DevicePlatform } from '@prisma/client';

export interface DeviceRecord {
  id: string;
  userId: string;
  deviceFingerprint: string;
  platform: DevicePlatform;
  model: string | null;
  osVersion: string | null;
  appVersion: string | null;
  pushToken: string | null;
  pushTokenUpdatedAt: Date | null;
  lastSeenAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class DeviceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    id: string;
    userId: string;
    deviceFingerprint: string;
    platform: DevicePlatform;
    model?: string;
    osVersion?: string;
    appVersion?: string;
    pushToken?: string;
  }): Promise<DeviceRecord> {
    return this.prisma.device.create({
      data: {
        id: data.id,
        userId: data.userId,
        deviceFingerprint: data.deviceFingerprint,
        platform: data.platform,
        model: data.model,
        osVersion: data.osVersion,
        appVersion: data.appVersion,
        pushToken: data.pushToken,
      },
    });
  }

  async findByFingerprint(userId: string, fingerprint: string): Promise<DeviceRecord | null> {
    return this.prisma.device.findUnique({
      where: { userId_deviceFingerprint: { userId, deviceFingerprint: fingerprint } },
    });
  }

  async findById(userId: string, deviceId: string): Promise<DeviceRecord | null> {
    return this.prisma.device.findFirst({
      where: { id: deviceId, userId },
    });
  }

  async listActive(userId: string): Promise<DeviceRecord[]> {
    return this.prisma.device.findMany({
      where: { userId, revokedAt: null },
      orderBy: { lastSeenAt: 'desc' },
    });
  }

  async revoke(deviceId: string, userId: string): Promise<DeviceRecord> {
    return this.prisma.device.update({
      where: { id: deviceId, userId },
      data: { revokedAt: new Date() },
    });
  }

  async updatePushToken(deviceId: string, pushToken: string): Promise<DeviceRecord> {
    return this.prisma.device.update({
      where: { id: deviceId },
      data: { pushToken, pushTokenUpdatedAt: new Date() },
    });
  }

  async updateLastSeen(deviceId: string): Promise<DeviceRecord> {
    return this.prisma.device.update({
      where: { id: deviceId },
      data: { lastSeenAt: new Date() },
    });
  }
}
