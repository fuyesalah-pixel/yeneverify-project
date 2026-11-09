// ============================================================
// Yene Verify â€” Google Auth DTOs
// POST /api/v1/auth/google, /auth/google/link, /auth/google/unlink
// POST /api/v1/auth/google/onboard, /auth/google/signin
// GET /api/v1/auth/device-accounts
// POST /api/v1/auth/device-accounts/:phoneLast4/signout
// ============================================================

import { z } from 'zod';

export const GoogleIdTokenDtoSchema = z.object({
  idToken: z.string().min(1, 'idToken is required'),
});

export type GoogleIdTokenDto = z.infer<typeof GoogleIdTokenDtoSchema>;

export const GoogleLoginResponseSchema = z.object({
  ok: z.boolean(),
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
});

export type GoogleLoginResponse = z.infer<typeof GoogleLoginResponseSchema>;

// ── Device info (shared across onboarding and signin) ──────────────────────

export const DeviceInfoSchema = z.object({
  fingerprint: z.string().min(1, 'device fingerprint is required'),
  platform: z.enum(['ANDROID', 'IOS']),
  model: z.string().optional(),
  osVersion: z.string().optional(),
  appVersion: z.string().optional(),
});

export type DeviceInfo = z.infer<typeof DeviceInfoSchema>;

// ── Onboard (first-time Google signup + phone pairing) ─────────────────────

export const GoogleOnboardDtoSchema = GoogleIdTokenDtoSchema.extend({
  phone: z
    .string()
    .min(1, 'phone is required')
    .regex(/^\+251[79]\d{8}$/, 'Invalid Ethiopian phone number format'),
  fullName: z.string().min(1, 'fullName is required'),
  device: DeviceInfoSchema,
});

export type GoogleOnboardDto = z.infer<typeof GoogleOnboardDtoSchema>;

export const GoogleOnboardResponseSchema = z.object({
  ok: z.boolean(),
  user: z.object({
    id: z.string(),
    phone: z.string(),
    fullName: z.string(),
    googleUid: z.string(),
    googleEmail: z.string(),
  }),
  accessToken: z.string(),
  refreshToken: z.string(),
  needsOnboarding: z.literal(true),
});

export type GoogleOnboardResponse = z.infer<typeof GoogleOnboardResponseSchema>;

// ── Signin (returning Google user) ─────────────────────────────────────────

export const GoogleSigninDtoSchema = GoogleIdTokenDtoSchema.extend({
  device: DeviceInfoSchema,
});

export type GoogleSigninDto = z.infer<typeof GoogleSigninDtoSchema>;

export const GoogleSigninResponseSchema = z.object({
  ok: z.boolean(),
  user: z.object({
    id: z.string(),
    phone: z.string(),
    fullName: z.string(),
    googleUid: z.string(),
    googleEmail: z.string(),
  }),
  accessToken: z.string(),
  refreshToken: z.string(),
  needsOnboarding: z.literal(false),
});

export type GoogleSigninResponse = z.infer<typeof GoogleSigninResponseSchema>;

// ── Device accounts (public, lists paired accounts on a device) ────────────

export const DeviceAccountsDtoSchema = z.object({
  deviceFingerprint: z.string().min(1, 'deviceFingerprint is required'),
});

export type DeviceAccountsDto = z.infer<typeof DeviceAccountsDtoSchema>;

export const DeviceAccountSchema = z.object({
  phoneLast4: z.string(),
  googleEmail: z.string(),
});

export type DeviceAccount = z.infer<typeof DeviceAccountSchema>;

export const DeviceAccountsResponseSchema = z.object({
  accounts: z.array(DeviceAccountSchema),
});

export type DeviceAccountsResponse = z.infer<typeof DeviceAccountsResponseSchema>;

// ── Device signout ─────────────────────────────────────────────────────────

export const DeviceSignoutDtoSchema = z.object({
  deviceFingerprint: z.string().min(1, 'deviceFingerprint is required'),
});

export type DeviceSignoutDto = z.infer<typeof DeviceSignoutDtoSchema>;
