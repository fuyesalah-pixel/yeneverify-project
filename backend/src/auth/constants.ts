// ============================================================
// Yene Verify — Auth Constants
// Centralized TTLs, limits, purposes for the auth module.
// ============================================================

import { AppConfigService } from '../config/config.service';

/** OTP purposes supported by the system. */
export enum OtpPurpose {
  LOGIN = 'LOGIN',
  DEVICE_BIND = 'DEVICE_BIND',
  PHONE_CHANGE = 'PHONE_CHANGE',
}

/** Extract auth constants from the typed config. */
export function getAuthConstants(config: AppConfigService) {
  return {
    otp: {
      length: config.otp.length,
      ttlSeconds: config.otp.ttlSeconds,
      maxAttempts: config.otp.maxAttempts,
      lockoutSeconds: config.otp.lockoutSeconds,
      hashRounds: config.otp.hashRounds,
      phoneHourlyLimit: config.otp.maxAttempts, // reuse config as hourly phone limit
      phonePurpose5MinLimit: 3,
      ipHourlyLimit: 20,
    },
    device: {
      maxActive: 3,
    },
    afromessage: {
      senderId: config.afroMessage.senderId,
    },
  } as const;
}

/** Token TTLs extracted from config. */
export function getTokenConstants(config: AppConfigService) {
  return {
    accessTtl: config.jwt.accessTtl,
    refreshTtl: config.jwt.refreshTtl,
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
    accessSecret: config.jwt.accessSecret,
    refreshSecret: config.jwt.refreshSecret,
  } as const;
}

/** Session constants. */
export function getSessionConstants(_config: AppConfigService) {
  return {
    refreshTokenBytes: 64,
    pruneRetentionDays: 30,
  } as const;
}
