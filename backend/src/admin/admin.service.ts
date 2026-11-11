// ============================================================
// Yene Verify — Admin Service
// Admin-only actions: Google Sign-In with email allowlist,
// user listing, and system health checks.
// ============================================================

import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import * as admin from 'firebase-admin';
import { DevicePlatform, Prisma, UserRole, UserStatus } from '@prisma/client';
import { AppConfigService } from '../config/config.service';
import { PrismaService } from '../prisma/prisma.service';
import { TokenService } from '../auth/tokens/token.service';
import { SessionService } from '../auth/session/session.service';
import { AuditService } from '../audit/audit.service';
import { RedisService } from '../redis/redis.service';
import { FIREBASE_ADMIN } from '../common/firebase/firebase-admin.provider';

const ADMIN_RATE_LIMIT_TTL_SECONDS = 60 * 60; // 1 hour
const ADMIN_RATE_LIMIT_MAX = 10;
// Admin web sessions reuse the Device table (the enum has no WEB platform).
const ADMIN_DEVICE_PREFIX = 'admin-web:';

interface VerifiedGoogleIdentity {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
}

export interface AdminLoginResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    role: UserRole;
    status: UserStatus;
  };
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly sessionService: SessionService,
    private readonly audit: AuditService,
    private readonly redis: RedisService,
    @Inject(FIREBASE_ADMIN) private readonly firebaseAdmin: admin.app.App,
  ) {}

  /**
   * Verify a Google ID token for admin access.
   * Only emails in ADMIN_EMAILS are permitted, and the resolved account must
   * carry the ADMIN role. Creates the admin user on first sign-in.
   */
  async googleLogin(dto: {
    idToken: string;
    ip?: string;
    userAgent?: string;
  }): Promise<AdminLoginResult> {
    const { idToken, ip, userAgent } = dto;

    // Rate limit: 10 per IP per hour
    if (ip) {
      const key = `admin-auth:ip:${ip}`;
      const count = await this.redis.incr(key, ADMIN_RATE_LIMIT_TTL_SECONDS);
      if (count > ADMIN_RATE_LIMIT_MAX) {
        throw new UnauthorizedException('Too many admin sign-in attempts. Please try again later.');
      }
    }

    let decoded: { sub: string; email?: string; email_verified?: boolean; name?: string };
    try {
      decoded = await this.verifyIdToken(idToken);
    } catch (e) {
      this.logger.error('Admin Google ID token verification failed:', e);
      throw new UnauthorizedException('Invalid or expired Google ID token.');
    }

    if (!decoded.email_verified) {
      throw new UnauthorizedException('Google email not verified.');
    }

    const email = decoded.email?.toLowerCase().trim();
    if (!email) {
      throw new UnauthorizedException('No email in Google token.');
    }

    const adminEmails = this.config.adminEmails
      .map((value) => value.toLowerCase().trim())
      .filter(Boolean);

    if (!adminEmails.includes(email)) {
      this.audit.log({
        actorType: 'ADMIN',
        action: 'auth.admin.google.login.rejected',
        targetType: 'google_uid',
        targetId: decoded.sub,
        ip,
        userAgent,
        metadata: { email, allowlistedEmailCount: adminEmails.length },
      });
      throw new ForbiddenException('Not authorized to access the admin dashboard.');
    }

    let user = await this.prisma.user.findUnique({ where: { googleUid: decoded.sub } });

    if (!user) {
      user = await this.prisma.user.findFirst({ where: { googleEmail: email } });
    }

    if (!user) {
      // Stable placeholder phone per allowlisted email keeps the unique phone
      // column satisfied without inventing a real number for a web-only admin.
      const placeholderPhone = this.adminPlaceholderPhone(Math.max(0, adminEmails.indexOf(email)));
      user = await this.prisma.user.findUnique({ where: { phone: placeholderPhone } });
    }

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          id: crypto.randomUUID(),
          phone: this.adminPlaceholderPhone(Math.max(0, adminEmails.indexOf(email))),
          fullName: decoded.name ?? email,
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
          googleUid: decoded.sub,
          googleEmail: email,
          googleLinkedAt: new Date(),
          lastLoginAt: new Date(),
        },
      });

      this.audit.log({
        actorType: 'ADMIN',
        actorUserId: user.id,
        action: 'auth.admin.google.login.created',
        targetType: 'user',
        targetId: user.id,
        ip,
        userAgent,
        metadata: { email, role: UserRole.ADMIN },
      });
    } else {
      if (user.role !== UserRole.ADMIN) {
        this.audit.log({
          actorType: 'ADMIN',
          actorUserId: user.id,
          action: 'auth.admin.google.login.invalid_role',
          targetType: 'user',
          targetId: user.id,
          ip,
          userAgent,
          metadata: { email, currentRole: user.role },
        });
        throw new ForbiddenException('Not authorized to access the admin dashboard.');
      }

      if (user.status === UserStatus.BANNED) {
        this.audit.log({
          actorType: 'ADMIN',
          actorUserId: user.id,
          action: 'auth.admin.google.login.fail',
          targetType: 'user',
          targetId: user.id,
          ip,
          userAgent,
          metadata: { reason: 'banned', email },
        });
        throw new UnauthorizedException('Account banned.');
      }

      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: new Date(),
          googleUid: user.googleUid ?? decoded.sub,
          googleEmail: user.googleEmail ?? email,
          googleLinkedAt: user.googleLinkedAt ?? new Date(),
        },
      });
    }

    // One device row per admin browser origin; reused across sign-ins.
    const fingerprint = `${ADMIN_DEVICE_PREFIX}${ip ?? 'unknown'}`;
    let device = await this.prisma.device.findFirst({
      where: { userId: user.id, deviceFingerprint: fingerprint },
    });

    if (device) {
      device = await this.prisma.device.update({
        where: { id: device.id },
        data: { lastSeenAt: new Date() },
      });
    } else {
      device = await this.prisma.device.create({
        data: {
          id: crypto.randomUUID(),
          userId: user.id,
          deviceFingerprint: fingerprint,
          platform: DevicePlatform.ANDROID,
          model: 'Admin Web Console',
          lastSeenAt: new Date(),
        },
      });
    }

    const { sessionId, rawRefreshToken } = await this.sessionService.createSession(
      user.id,
      device.id,
      ip,
      userAgent,
    );

    const accessToken = this.tokenService.signAccessToken({
      sub: user.id,
      role: user.role,
      sid: sessionId,
      did: device.id,
    });

    this.audit.log({
      actorType: 'ADMIN',
      actorUserId: user.id,
      action: 'auth.admin.google.login.success',
      targetType: 'user',
      targetId: user.id,
      ip,
      userAgent,
      metadata: { email, deviceId: device.id },
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: Math.floor(this.parseTtl(this.config.jwt.accessTtl) / 1000),
      user: {
        id: user.id,
        email,
        role: user.role,
        status: user.status,
      },
    };
  }

  /**
   * System health check for the admin dashboard.
   */
  async getHealth() {
    const checks = {
      database: false,
      redis: false,
      firebase: false,
    };

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = true;
    } catch {
      checks.database = false;
    }

    try {
      checks.redis = (await this.redis.raw.ping()) === 'PONG';
    } catch {
      checks.redis = false;
    }

    checks.firebase = Boolean(this.firebaseAdmin);

    const allUp = checks.database && checks.redis && checks.firebase;

    return {
      status: allUp ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    };
  }

  /**
   * List users with filters and pagination (admin only).
   * Defaults to merchant and sub-merchant accounts; ADMIN rows appear only
   * when explicitly requested through the role filter.
   */
  async getUsers(dto: {
    page?: number;
    pageSize?: number;
    role?: UserRole;
    status?: UserStatus;
    search?: string;
  }) {
    const page = Math.max(1, dto.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, dto.pageSize ?? 20));
    const skip = (page - 1) * pageSize;

    const where: Prisma.UserWhereInput = {
      role: dto.role ?? { in: [UserRole.MERCHANT, UserRole.SUB_MERCHANT] },
    };

    if (dto.status) {
      where.status = dto.status;
    }

    if (dto.search?.trim()) {
      const search = dto.search.trim();
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { googleEmail: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          phone: true,
          fullName: true,
          role: true,
          status: true,
          googleEmail: true,
          googleLinkedAt: true,
          lastLoginAt: true,
          createdAt: true,
          pinSetAt: true,
          ownedMerchant: {
            select: {
              id: true,
              businessName: true,
              status: true,
              creditsBalance: true,
              currentPackageCode: true,
            },
          },
          subMerchantProfile: {
            select: {
              id: true,
              status: true,
              branchLabel: true,
              merchant: {
                select: { id: true, businessName: true, status: true },
              },
            },
          },
          _count: {
            select: { sessions: true },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users: users.map((user) => {
        const owned = user.ownedMerchant;
        const sub = user.subMerchantProfile;

        return {
          id: user.id,
          fullName: user.fullName,
          phone: user.phone,
          googleEmail: user.googleEmail,
          googleLinkedAt: user.googleLinkedAt,
          role: user.role,
          status: user.status,
          creditsBalance: owned ? owned.creditsBalance.toString() : null,
          packageCode: owned?.currentPackageCode ?? null,
          merchant: owned
            ? {
                id: owned.id,
                businessName: owned.businessName,
                status: owned.status,
                relation: 'OWNER' as const,
              }
            : sub
              ? {
                  id: sub.merchant.id,
                  businessName: sub.merchant.businessName,
                  status: sub.merchant.status,
                  relation: 'SUB_MERCHANT' as const,
                  branchLabel: sub.branchLabel,
                }
              : null,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
          pinSetAt: user.pinSetAt,
          sessionCount: user._count.sessions,
        };
      }),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Verify a Google ID token. Separate method so tests can stub it.
   *
   * Firebase ID tokens (mobile) carry the Firebase project as their audience
   * and verify through firebase-admin. Google Identity Services tokens (the
   * web admin button) carry the OAuth client ID instead, and firebase-admin
   * rejects them on the audience claim, so they fall back to Google's
   * tokeninfo endpoint, which validates the signature and returns the claims.
   */
  private async verifyIdToken(idToken: string): Promise<VerifiedGoogleIdentity> {
    let firebaseError: unknown;

    try {
      const { getAuth } = await import('firebase-admin/auth');
      const decoded = await getAuth(this.firebaseAdmin).verifyIdToken(idToken);
      return {
        sub: decoded.sub,
        email: decoded.email,
        email_verified: decoded.email_verified,
        name: decoded.name,
      };
    } catch (error) {
      firebaseError = error;
    }

    return this.verifyGoogleOAuthIdToken(idToken, firebaseError);
  }

  /** Verify a Google OAuth ID token (Google Identity Services, web). */
  private async verifyGoogleOAuthIdToken(
    idToken: string,
    originalError: unknown,
  ): Promise<VerifiedGoogleIdentity> {
    const clientId = this.config.googleWebClientId;
    if (!clientId) throw originalError;

    let response: { ok: boolean; json: () => Promise<unknown> };
    try {
      response = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
      );
    } catch {
      throw originalError;
    }

    if (!response.ok) throw originalError;

    const payload = (await response.json().catch(() => null)) as {
      aud?: string;
      sub?: string;
      email?: string;
      email_verified?: string;
      name?: string;
      iss?: string;
      exp?: string;
    } | null;

    if (!payload?.sub || payload.aud !== clientId) throw originalError;
    if (payload.iss !== 'accounts.google.com' && payload.iss !== 'https://accounts.google.com') {
      throw originalError;
    }
    if (!payload.exp || Number(payload.exp) * 1000 <= Date.now()) throw originalError;

    return {
      sub: payload.sub,
      email: payload.email,
      email_verified: payload.email_verified === 'true',
      name: payload.name,
    };
  }

  /** +251900000001, +251900000002, ... one per allowlisted admin email. */
  private adminPlaceholderPhone(index: number): string {
    return `+2519000000${String(index + 1).padStart(2, '0')}`;
  }

  private parseTtl(ttl: string): number {
    const match = ttl.match(/^(\d+)([smhd])$/);
    if (!match) return 15 * 60 * 1000;
    const value = parseInt(match[1], 10);
    switch (match[2]) {
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      default:
        return 15 * 60 * 1000;
    }
  }
}
