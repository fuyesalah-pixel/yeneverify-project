// ============================================================
// Yene Verify — Admin Service
// Admin-only actions: Google Sign-In with email allowlist,
// user listing, and system health checks.
// ============================================================

import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as admin from 'firebase-admin';
import {
  DevicePlatform,
  MerchantStatus,
  PackageCode,
  Prisma,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { AppConfigService } from '../config/config.service';
import { PrismaService } from '../prisma/prisma.service';
import { TokenService } from '../auth/tokens/token.service';
import { SessionService } from '../auth/session/session.service';
import { AuditService } from '../audit/audit.service';
import { RedisService } from '../redis/redis.service';
import { CreditsService } from '../credits/credits.service';
import { LOW_CREDITS_WARNING_THRESHOLD } from '../credits/credits.service';
import { FIREBASE_ADMIN } from '../common/firebase/firebase-admin.provider';

const ADMIN_RATE_LIMIT_TTL_SECONDS = 60 * 60; // 1 hour
const ADMIN_RATE_LIMIT_MAX = 10;
// Admin web sessions reuse the Device table (the enum has no WEB platform).
const ADMIN_DEVICE_PREFIX = 'admin-web:';

/** Manual status changes an admin may apply to a merchant account. */
export type AdminStatusAction = 'SUSPEND' | 'BAN' | 'REACTIVATE';

const STATUS_ACTION_TARGET: Record<AdminStatusAction, UserStatus> = {
  SUSPEND: UserStatus.SUSPENDED,
  BAN: UserStatus.BANNED,
  REACTIVATE: UserStatus.ACTIVE,
};

const STATUS_ACTION_MERCHANT: Record<AdminStatusAction, MerchantStatus> = {
  SUSPEND: MerchantStatus.SUSPENDED,
  BAN: MerchantStatus.BANNED,
  REACTIVATE: MerchantStatus.ACTIVE,
};

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
    private readonly credits: CreditsService,
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
    package?: PackageCode;
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

    const search = dto.search?.trim();

    // Package and business-name filtering both live on the owned merchant.
    const merchantFilter: Prisma.MerchantWhereInput = {};
    if (dto.package) {
      merchantFilter.currentPackageCode = dto.package;
    }
    if (search) {
      merchantFilter.businessName = { contains: search, mode: 'insensitive' };
    }
    if (Object.keys(merchantFilter).length > 0) {
      where.ownedMerchant = merchantFilter;
    }

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { googleEmail: { contains: search, mode: 'insensitive' } },
        { ownedMerchant: { businessName: { contains: search, mode: 'insensitive' } } },
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

  // ── user detail ────────────────────────────────────────────────────────

  /**
   * Everything the admin console shows for one account: profile, tenant,
   * subscription, credit position, activity counts, recent rows, devices.
   * BigInt columns cross the wire as strings.
   */
  async getUserDetail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        phone: true,
        phoneVerifiedAt: true,
        role: true,
        status: true,
        preferredLanguage: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
        lastLoginAt: true,
        pinSetAt: true,
        pinFailedAttempts: true,
        pinLockedUntil: true,
        biometricEnabled: true,
        googleEmail: true,
        googleLinkedAt: true,
        phonePairedAt: true,
        ownedMerchant: {
          select: {
            id: true,
            businessName: true,
            businessType: true,
            tin: true,
            address: true,
            city: true,
            region: true,
            status: true,
            creditsBalance: true,
            creditsUpdatedAt: true,
            currentPackageCode: true,
            createdAt: true,
          },
        },
        subMerchantProfile: {
          select: {
            id: true,
            branchLabel: true,
            status: true,
            invitedAt: true,
            joinedAt: true,
            merchant: {
              select: {
                id: true,
                businessName: true,
                status: true,
                creditsBalance: true,
                currentPackageCode: true,
              },
            },
          },
        },
        devices: {
          orderBy: [{ revokedAt: 'asc' }, { lastSeenAt: 'desc' }],
          select: {
            id: true,
            platform: true,
            model: true,
            osVersion: true,
            appVersion: true,
            lastSeenAt: true,
            revokedAt: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const merchant = user.ownedMerchant;
    const subMerchant = user.subMerchantProfile;
    const merchantId = merchant?.id ?? subMerchant?.merchant.id ?? null;

    const [subscription, ledger, byType, verificationCounts, transactions, creditRows, verifications, auditRows, sessionCount, activeSessions] =
      await Promise.all([
        merchantId
          ? this.prisma.subscription.findFirst({
              where: { merchantId },
              orderBy: { createdAt: 'desc' },
              select: {
                id: true,
                packageCode: true,
                status: true,
                startedAt: true,
                expiresAt: true,
                cancelledAt: true,
                autoRenew: true,
                createdAt: true,
                package: {
                  select: {
                    name: true,
                    priceMinor: true,
                    currency: true,
                    creditsPerMonth: true,
                    unlimited: true,
                  },
                },
              },
            })
          : Promise.resolve(null),
        merchantId
          ? this.prisma.creditTransaction.aggregate({
              where: { merchantId, type: { not: 'ADJUSTMENT' } },
              _sum: { amount: true },
            })
          : Promise.resolve({ _sum: { amount: null } }),
        merchantId
          ? this.prisma.creditTransaction.groupBy({
              by: ['type'],
              where: { merchantId },
              _sum: { amount: true },
              _count: { _all: true },
            })
          : Promise.resolve([]),
        merchantId
          ? this.prisma.verification.groupBy({
              by: ['status'],
              where: { merchantId },
              _count: { _all: true },
            })
          : Promise.resolve([]),
        merchantId
          ? this.prisma.transaction.findMany({
              where: { merchantId },
              orderBy: { createdAt: 'desc' },
              take: 8,
              select: {
                id: true,
                bankCode: true,
                bankReference: true,
                amountMinor: true,
                status: true,
                paidAt: true,
                createdAt: true,
                verifiedBy: { select: { fullName: true } },
                subMerchant: { select: { branchLabel: true } },
              },
            })
          : Promise.resolve([]),
        merchantId
          ? this.prisma.creditTransaction.findMany({
              where: { merchantId },
              orderBy: { createdAt: 'desc' },
              take: 10,
              select: {
                id: true,
                type: true,
                amount: true,
                balanceAfter: true,
                reason: true,
                createdAt: true,
                actorUser: { select: { fullName: true, googleEmail: true } },
              },
            })
          : Promise.resolve([]),
        merchantId
          ? this.prisma.verification.findMany({
              where: { merchantId },
              orderBy: { createdAt: 'desc' },
              take: 8,
              select: {
                id: true,
                bankCode: true,
                bankReference: true,
                amountMinor: true,
                status: true,
                source: true,
                createdAt: true,
              },
            })
          : Promise.resolve([]),
        this.prisma.auditLog.findMany({
          where: {
            OR: [
              { targetType: 'user', targetId: userId },
              { actorUserId: userId },
              ...(merchantId ? [{ merchantId }] : []),
            ],
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            actorType: true,
            action: true,
            targetType: true,
            targetId: true,
            metadata: true,
            createdAt: true,
            actorUser: { select: { fullName: true, googleEmail: true } },
          },
        }),
        this.prisma.session.count({ where: { userId } }),
        this.prisma.session.count({ where: { userId, revokedAt: null } }),
      ]);

    const typeTotals = new Map<string, bigint>();
    for (const row of byType) {
      typeTotals.set(row.type, row._sum.amount ?? 0n);
    }

    const verificationByStatus: Record<string, number> = {};
    for (const row of verificationCounts) {
      verificationByStatus[row.status] = row._count._all;
    }

    return {
      profile: {
        id: user.id,
        fullName: user.fullName,
        phone: user.phone,
        phoneVerifiedAt: user.phoneVerifiedAt,
        role: user.role,
        status: user.status,
        preferredLanguage: user.preferredLanguage,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        deletedAt: user.deletedAt,
        lastLoginAt: user.lastLoginAt,
        googleEmail: user.googleEmail,
        googleLinkedAt: user.googleLinkedAt,
        phonePairedAt: user.phonePairedAt,
        pin: {
          set: Boolean(user.pinSetAt),
          setAt: user.pinSetAt,
          failedAttempts: user.pinFailedAttempts,
          lockedUntil: user.pinLockedUntil,
          biometricEnabled: user.biometricEnabled,
        },
      },
      merchant: merchant
        ? {
            id: merchant.id,
            businessName: merchant.businessName,
            businessType: merchant.businessType,
            tin: merchant.tin,
            address: merchant.address,
            city: merchant.city,
            region: merchant.region,
            status: merchant.status,
            creditsBalance: merchant.creditsBalance.toString(),
            creditsUpdatedAt: merchant.creditsUpdatedAt,
            currentPackageCode: merchant.currentPackageCode,
            createdAt: merchant.createdAt,
            relation: 'OWNER' as const,
          }
        : subMerchant
          ? {
              id: subMerchant.merchant.id,
              businessName: subMerchant.merchant.businessName,
              businessType: null,
              tin: null,
              address: null,
              city: null,
              region: null,
              status: subMerchant.merchant.status,
              creditsBalance: subMerchant.merchant.creditsBalance.toString(),
              creditsUpdatedAt: null,
              currentPackageCode: subMerchant.merchant.currentPackageCode,
              createdAt: null,
              relation: 'SUB_MERCHANT' as const,
              branchLabel: subMerchant.branchLabel,
              subMerchantStatus: subMerchant.status,
              joinedAt: subMerchant.joinedAt,
            }
          : null,
      subscription: subscription
        ? {
            id: subscription.id,
            packageCode: subscription.packageCode,
            packageName: subscription.package?.name ?? null,
            unlimited: subscription.package?.unlimited ?? false,
            creditsPerMonth: subscription.package?.creditsPerMonth ?? null,
            priceMinor: subscription.package?.priceMinor?.toString() ?? null,
            currency: subscription.package?.currency ?? 'ETB',
            status: subscription.status,
            startedAt: subscription.startedAt,
            expiresAt: subscription.expiresAt,
            cancelledAt: subscription.cancelledAt,
            autoRenew: subscription.autoRenew,
            createdAt: subscription.createdAt,
          }
        : null,
      credits: {
        merchantId,
        ledgerBalance: (ledger._sum.amount ?? 0n).toString(),
        lifetimeGranted: (typeTotals.get('GRANT') ?? 0n).toString(),
        lifetimeConsumed: (-(typeTotals.get('CONSUME') ?? 0n)).toString(),
        lifetimeRefunded: (typeTotals.get('REFUND') ?? 0n).toString(),
        lifetimeExpired: (-(typeTotals.get('EXPIRE') ?? 0n)).toString(),
      },
      activity: {
        verifications: verificationByStatus,
        totalVerifications: Object.values(verificationByStatus).reduce((a, b) => a + b, 0),
        transactions: transactions.length,
        sessions: sessionCount,
        activeSessions,
      },
      recentTransactions: transactions.map((row) => ({
        id: row.id,
        bankCode: row.bankCode,
        bankReference: row.bankReference,
        amountMinor: row.amountMinor.toString(),
        status: row.status,
        paidAt: row.paidAt,
        createdAt: row.createdAt,
        verifiedBy: row.verifiedBy?.fullName ?? null,
        branchLabel: row.subMerchant?.branchLabel ?? null,
      })),
      recentCredits: creditRows.map((row) => ({
        id: row.id,
        type: row.type,
        amount: row.amount.toString(),
        balanceAfter: row.balanceAfter.toString(),
        reason: row.reason,
        createdAt: row.createdAt,
        actorName: row.actorUser?.fullName ?? null,
        actorEmail: row.actorUser?.googleEmail ?? null,
      })),
      recentVerifications: verifications.map((row) => ({
        id: row.id,
        bankCode: row.bankCode,
        bankReference: row.bankReference,
        amountMinor: row.amountMinor?.toString() ?? null,
        status: row.status,
        source: row.source,
        createdAt: row.createdAt,
      })),
      auditTrail: auditRows.map((row) => ({
        id: row.id,
        actorType: row.actorType,
        action: row.action,
        targetType: row.targetType,
        targetId: row.targetId,
        metadata: row.metadata,
        createdAt: row.createdAt,
        actorName: row.actorUser?.fullName ?? null,
        actorEmail: row.actorUser?.googleEmail ?? null,
      })),
      devices: user.devices.map((device) => ({
        id: device.id,
        platform: device.platform,
        model: device.model,
        osVersion: device.osVersion,
        appVersion: device.appVersion,
        lastSeenAt: device.lastSeenAt,
        revokedAt: device.revokedAt,
        createdAt: device.createdAt,
      })),
    };
  }

  // ── user actions ───────────────────────────────────────────────────────

  /**
   * Suspend, ban, or reactivate an account.
   *
   * The user row and their owned merchant move together (a suspended account
   * whose business stays ACTIVE would keep verifying), and every live session
   * is revoked so access tokens stop working immediately. Devices are left
   * alone on purpose: they are the user's trusted hardware and a revoked
   * device cannot be re-verified after reactivation without re-pairing.
   */
  async setUserStatus(input: {
    userId: string;
    action: AdminStatusAction;
    reason?: string;
    actorUserId: string;
    ip?: string;
    userAgent?: string;
  }) {
    const user = await this.prisma.user.findUnique({
      where: { id: input.userId },
      select: {
        id: true,
        role: true,
        status: true,
        ownedMerchant: { select: { id: true, status: true } },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (user.role === UserRole.ADMIN) {
      throw new ForbiddenException('Admin accounts cannot be suspended from the user console.');
    }

    const nextStatus = STATUS_ACTION_TARGET[input.action];
    if (user.status === nextStatus) {
      return { changed: false, status: user.status, merchantStatus: user.ownedMerchant?.status ?? null };
    }

    const nextMerchantStatus = STATUS_ACTION_MERCHANT[input.action];
    const deactivating = nextStatus !== UserStatus.ACTIVE;

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          status: nextStatus,
          deletedAt: nextStatus === UserStatus.ACTIVE ? null : undefined,
        },
      });

      if (user.ownedMerchant) {
        await tx.merchant.update({
          where: { id: user.ownedMerchant.id },
          data: { status: nextMerchantStatus },
        });
      }

      if (deactivating) {
        await tx.session.updateMany({
          where: { userId: user.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    });

    this.audit.log({
      actorType: 'ADMIN',
      actorUserId: input.actorUserId,
      action: `admin.user.${input.action.toLowerCase()}`,
      targetType: 'user',
      targetId: user.id,
      ip: input.ip,
      userAgent: input.userAgent,
      metadata: {
        userId: user.id,
        reason: input.reason ?? null,
        before: { status: user.status, merchantStatus: user.ownedMerchant?.status ?? null },
        after: { status: nextStatus, merchantStatus: user.ownedMerchant ? nextMerchantStatus : null },
        sessionsRevoked: deactivating,
      },
    });

    return {
      changed: true,
      status: nextStatus,
      merchantStatus: user.ownedMerchant ? nextMerchantStatus : null,
    };
  }

  /**
   * Move an account between merchant and sub-merchant. The target role must
   * already have the matching membership record, and admin roles stay out of
   * this console (they are governed by the email allowlist).
   */
  async changeUserRole(input: {
    userId: string;
    role: UserRole;
    reason?: string;
    actorUserId: string;
    ip?: string;
    userAgent?: string;
  }) {
    if (input.userId === input.actorUserId) {
      throw new ForbiddenException('You cannot change your own role.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: input.userId },
      select: {
        id: true,
        role: true,
        ownedMerchant: { select: { id: true } },
        subMerchantProfile: { select: { id: true } },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (user.role === UserRole.ADMIN || input.role === UserRole.ADMIN) {
      throw new ForbiddenException('Admin roles are managed through the admin allowlist.');
    }

    if (user.role === input.role) {
      return { changed: false, role: user.role };
    }

    if (input.role === UserRole.SUB_MERCHANT && !user.subMerchantProfile) {
      throw new BadRequestException(
        'This user has no sub-merchant membership; invite them to a merchant first.',
      );
    }

    if (input.role === UserRole.MERCHANT && !user.ownedMerchant) {
      throw new BadRequestException('This user does not own a merchant account.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { role: input.role },
    });

    this.audit.log({
      actorType: 'ADMIN',
      actorUserId: input.actorUserId,
      action: 'admin.user.role_changed',
      targetType: 'user',
      targetId: user.id,
      ip: input.ip,
      userAgent: input.userAgent,
      metadata: {
        userId: user.id,
        reason: input.reason ?? null,
        before: { role: user.role },
        after: { role: input.role },
      },
    });

    return { changed: true, role: input.role };
  }

  /**
   * Adjust credits for the merchant behind a user account. Owners write to
   * their own merchant; sub-merchants write to the merchant they belong to.
   */
  async adjustUserCredits(input: {
    userId: string;
    amount: bigint;
    reason: string;
    actorUserId: string;
    ip?: string;
    userAgent?: string;
  }) {
    const user = await this.prisma.user.findUnique({
      where: { id: input.userId },
      select: {
        id: true,
        ownedMerchant: { select: { id: true } },
        subMerchantProfile: { select: { merchant: { select: { id: true } } } },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const merchantId = user.ownedMerchant?.id ?? user.subMerchantProfile?.merchant.id;
    if (!merchantId) {
      throw new BadRequestException('This user has no merchant account to credit.');
    }

    const result = await this.adjustCredits({
      merchantId,
      amount: input.amount,
      reason: input.reason,
      actorUserId: input.actorUserId,
      ip: input.ip,
      userAgent: input.userAgent,
    });

    return { ...result, userId: user.id };
  }

  /**
   * Clear a user's PIN so the next unlock requires setting a new one.
   * Every session is revoked: the point of an admin PIN reset is that the
   * person holding the phone can no longer get in with the old PIN.
   */
  async resetUserPin(input: {
    userId: string;
    actorUserId: string;
    ip?: string;
    userAgent?: string;
  }) {
    const user = await this.prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true, role: true, pinSetAt: true },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (user.role === UserRole.ADMIN) {
      throw new ForbiddenException('Admin accounts do not use a PIN.');
    }

    const [updated, sessions] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          pinHash: null,
          pinSetAt: null,
          pinFailedAttempts: 0,
          pinLockedUntil: null,
        },
        select: { id: true, pinSetAt: true },
      }),
      this.prisma.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    this.audit.log({
      actorType: 'ADMIN',
      actorUserId: input.actorUserId,
      action: 'admin.user.pin_reset',
      targetType: 'user',
      targetId: user.id,
      ip: input.ip,
      userAgent: input.userAgent,
      metadata: {
        userId: user.id,
        previousPinSetAt: user.pinSetAt,
        sessionsRevoked: sessions.count,
      },
    });

    return { pinSet: Boolean(updated.pinSetAt), sessionsRevoked: sessions.count };
  }

  /** Revoke one trusted device and kill the sessions on it. */
  async revokeUserDevice(input: {
    userId: string;
    deviceId: string;
    actorUserId: string;
    ip?: string;
    userAgent?: string;
  }) {
    const device = await this.prisma.device.findFirst({
      where: { id: input.deviceId, userId: input.userId },
      select: { id: true, model: true, platform: true, revokedAt: true },
    });

    if (!device) {
      throw new NotFoundException('Device not found for this user.');
    }

    if (device.revokedAt) {
      return { revoked: false, alreadyRevoked: true };
    }

    const [updated, sessions] = await this.prisma.$transaction([
      this.prisma.device.update({
        where: { id: device.id },
        data: { revokedAt: new Date() },
        select: { id: true, revokedAt: true },
      }),
      this.prisma.session.updateMany({
        where: { deviceId: device.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    this.audit.log({
      actorType: 'ADMIN',
      actorUserId: input.actorUserId,
      action: 'admin.user.device_revoked',
      targetType: 'device',
      targetId: device.id,
      ip: input.ip,
      userAgent: input.userAgent,
      metadata: {
        userId: input.userId,
        model: device.model,
        platform: device.platform,
        sessionsRevoked: sessions.count,
      },
    });

    return { revoked: true, revokedAt: updated.revokedAt, sessionsRevoked: sessions.count };
  }

  // ── merchants (credit holder search) ───────────────────────────────────

  /** Merchant lookup for the manual-credit flow. */
  async listMerchants(dto: { search?: string; page?: number; pageSize?: number }) {
    const page = Math.max(1, dto.page ?? 1);
    const pageSize = Math.min(50, Math.max(1, dto.pageSize ?? 10));
    const search = dto.search?.trim();

    const where: Prisma.MerchantWhereInput = { deletedAt: null };
    if (search) {
      where.OR = [
        { businessName: { contains: search, mode: 'insensitive' } },
        { owner: { fullName: { contains: search, mode: 'insensitive' } } },
        { owner: { phone: { contains: search } } },
        { owner: { googleEmail: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.merchant.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          businessName: true,
          status: true,
          creditsBalance: true,
          currentPackageCode: true,
          createdAt: true,
          owner: { select: { id: true, fullName: true, phone: true, googleEmail: true } },
        },
      }),
      this.prisma.merchant.count({ where }),
    ]);

    return {
      merchants: rows.map((row) => ({
        id: row.id,
        businessName: row.businessName,
        status: row.status,
        creditsBalance: row.creditsBalance.toString(),
        packageCode: row.currentPackageCode,
        createdAt: row.createdAt,
        owner: {
          id: row.owner.id,
          fullName: row.owner.fullName,
          phone: row.owner.phone,
          googleEmail: row.owner.googleEmail,
        },
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // ── credits ────────────────────────────────────────────────────────────

  /**
   * Manual credit correction against a merchant's ledger.
   * The amount is signed: positive adds credits, negative removes them.
   */
  async adjustCredits(input: {
    merchantId: string;
    amount: bigint;
    reason: string;
    actorUserId: string;
    ip?: string;
    userAgent?: string;
  }) {
    if (input.amount === 0n) {
      throw new BadRequestException('Credit adjustment amount cannot be zero.');
    }

    const reason = input.reason.trim();
    if (reason.length < 3) {
      throw new BadRequestException('A reason of at least 3 characters is required.');
    }

    const merchant = await this.prisma.merchant.findUnique({
      where: { id: input.merchantId },
      select: { id: true, businessName: true, creditsBalance: true, deletedAt: true },
    });

    if (!merchant || merchant.deletedAt) {
      throw new NotFoundException('Merchant not found.');
    }

    const result = await this.credits.adjust({
      merchantId: merchant.id,
      amount: input.amount,
      reason,
      actorUserId: input.actorUserId,
    });

    this.audit.log({
      actorType: 'ADMIN',
      actorUserId: input.actorUserId,
      action: 'admin.credits.adjusted',
      targetType: 'merchant',
      targetId: merchant.id,
      ip: input.ip,
      userAgent: input.userAgent,
      metadata: {
        merchantId: merchant.id,
        businessName: merchant.businessName,
        amount: input.amount.toString(),
        previousBalance: result.previousBalance.toString(),
        newBalance: result.newBalance.toString(),
        reason,
        ledgerTxId: result.txId,
      },
    });

    return {
      merchantId: merchant.id,
      businessName: merchant.businessName,
      amount: input.amount.toString(),
      previousBalance: result.previousBalance.toString(),
      newBalance: result.newBalance.toString(),
      ledgerTxId: result.txId,
      reason,
    };
  }

  /**
   * Platform-wide credit position: totals, a 30-day issue/consume series,
   * the heaviest consumers, low balances, and recent manual adjustments.
   */
  async getCreditsOverview() {
    const now = new Date();
    const since = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
    since.setUTCHours(0, 0, 0, 0);

    const [byType, cached, unlimitedPackages, daily, topRows, lowBalance, recentAdjustments, merchantCount, withBalance] =
      await Promise.all([
        this.prisma.creditTransaction.groupBy({
          by: ['type'],
          _sum: { amount: true },
          _count: { _all: true },
        }),
        this.prisma.merchant.aggregate({
          where: { deletedAt: null },
          _sum: { creditsBalance: true },
        }),
        this.prisma.package.findMany({ where: { unlimited: true }, select: { code: true } }),
        this.prisma.$queryRaw<Array<{ day: string; granted: string; consumed: string }>>`
          SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
                 COALESCE(SUM(amount) FILTER (WHERE type = 'GRANT'), 0)::text AS granted,
                 COALESCE(-SUM(amount) FILTER (WHERE type = 'CONSUME'), 0)::text AS consumed
          FROM credit_transactions
          WHERE created_at >= ${since} AND type <> 'ADJUSTMENT'
          GROUP BY 1
          ORDER BY 1
        `,
        this.prisma.creditTransaction.groupBy({
          by: ['merchantId'],
          where: { type: 'CONSUME', createdAt: { gte: since } },
          _sum: { amount: true },
          orderBy: { _sum: { amount: 'asc' } },
          take: 8,
        }),
        this.prisma.merchant.findMany({
          where: {
            deletedAt: null,
            creditsBalance: { lte: LOW_CREDITS_WARNING_THRESHOLD },
          },
          orderBy: [{ creditsBalance: 'asc' }, { createdAt: 'asc' }],
          take: 8,
          select: {
            id: true,
            businessName: true,
            creditsBalance: true,
            currentPackageCode: true,
            owner: { select: { fullName: true, phone: true } },
          },
        }),
        this.prisma.auditLog.findMany({
          where: { action: 'admin.credits.adjusted' },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            targetId: true,
            metadata: true,
            createdAt: true,
            actorUser: { select: { fullName: true, googleEmail: true } },
          },
        }),
        this.prisma.merchant.count({ where: { deletedAt: null } }),
        this.prisma.merchant.count({ where: { deletedAt: null, creditsBalance: { gt: 0 } } }),
      ]);

    const typeTotals = new Map<string, bigint>();
    const typeCounts = new Map<string, number>();
    for (const row of byType) {
      typeTotals.set(row.type, row._sum.amount ?? 0n);
      typeCounts.set(row.type, row._count._all);
    }

    const granted = typeTotals.get('GRANT') ?? 0n;
    const consumed = -(typeTotals.get('CONSUME') ?? 0n);
    const refunded = typeTotals.get('REFUND') ?? 0n;
    const expired = -(typeTotals.get('EXPIRE') ?? 0n);

    // Fill the 30-day window so the chart has no gaps.
    const byDay = new Map(daily.map((row) => [row.day, row]));
    const series: Array<{ date: string; granted: number; consumed: number }> = [];
    for (let i = 0; i < 30; i += 1) {
      const date = new Date(since.getTime() + i * 24 * 60 * 60 * 1000);
      const key = date.toISOString().slice(0, 10);
      const row = byDay.get(key);
      series.push({
        date: key,
        granted: row ? Number(row.granted) : 0,
        consumed: row ? Number(row.consumed) : 0,
      });
    }

    const topMerchantIds = topRows.map((row) => row.merchantId);
    const topMerchants = topMerchantIds.length
      ? await this.prisma.merchant.findMany({
          where: { id: { in: topMerchantIds } },
          select: { id: true, businessName: true, creditsBalance: true, currentPackageCode: true },
        })
      : [];
    const topById = new Map(topMerchants.map((row) => [row.id, row]));

    const unlimitedCodes = unlimitedPackages.map((row) => row.code);
    const unlimitedMerchants = unlimitedCodes.length
      ? await this.prisma.merchant.count({
          where: { deletedAt: null, currentPackageCode: { in: unlimitedCodes } },
        })
      : 0;

    return {
      totals: {
        granted: granted.toString(),
        consumed: consumed.toString(),
        refunded: refunded.toString(),
        expired: expired.toString(),
        netIssued: (granted + refunded - consumed - expired).toString(),
        cachedBalanceTotal: (cached._sum.creditsBalance ?? 0n).toString(),
        merchants: merchantCount,
        merchantsWithCredits: withBalance,
        unlimitedMerchants,
        ledgerRows: byType.reduce((sum, row) => sum + row._count._all, 0),
        adjustments: (typeTotals.get('ADJUSTMENT') ?? 0n).toString(),
        adjustmentCount: typeCounts.get('ADJUSTMENT') ?? 0,
      },
      series,
      seriesTotals: series.reduce(
        (acc, row) => ({ granted: acc.granted + row.granted, consumed: acc.consumed + row.consumed }),
        { granted: 0, consumed: 0 },
      ),
      topConsumers: topRows.map((row) => {
        const merchant = topById.get(row.merchantId);
        return {
          merchantId: row.merchantId,
          businessName: merchant?.businessName ?? 'Unknown merchant',
          packageCode: merchant?.currentPackageCode ?? null,
          creditsBalance: merchant?.creditsBalance.toString() ?? '0',
          consumed: (-(row._sum.amount ?? 0n)).toString(),
        };
      }),
      lowBalance: lowBalance.map((row) => ({
        merchantId: row.id,
        businessName: row.businessName,
        ownerName: row.owner.fullName,
        ownerPhone: row.owner.phone,
        creditsBalance: row.creditsBalance.toString(),
        packageCode: row.currentPackageCode,
      })),
      recentAdjustments: recentAdjustments.map((row) => {
        const metadata = (row.metadata ?? {}) as Record<string, unknown>;
        return {
          id: row.id,
          merchantId: row.targetId,
          businessName: typeof metadata.businessName === 'string' ? metadata.businessName : null,
          amount: typeof metadata.amount === 'string' ? metadata.amount : null,
          newBalance: typeof metadata.newBalance === 'string' ? metadata.newBalance : null,
          reason: typeof metadata.reason === 'string' ? metadata.reason : null,
          createdAt: row.createdAt,
          actorName: row.actorUser?.fullName ?? null,
          actorEmail: row.actorUser?.googleEmail ?? null,
        };
      }),
      generatedAt: now.toISOString(),
    };
  }

  /**
   * Per-merchant credit position for the reports table: current balance,
   * consumption over the last 30 days, and the most recent positive grant.
   */
  async getMerchantCreditStats(dto: { page?: number; pageSize?: number; search?: string }) {
    const page = Math.max(1, dto.page ?? 1);
    const pageSize = Math.min(50, Math.max(1, dto.pageSize ?? 20));
    const since = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
    since.setUTCHours(0, 0, 0, 0);
    const search = dto.search?.trim();
    const pattern = search ? `%${search}%` : null;

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<
        Array<{
          id: string;
          businessName: string;
          creditsBalance: string;
          consumed30d: string;
          lastTopUp: Date | null;
        }>
      >`
        WITH consumed AS (
          SELECT merchant_id, -SUM(amount) AS consumed
          FROM credit_transactions
          WHERE type = 'CONSUME' AND created_at >= ${since}
          GROUP BY merchant_id
        ),
        topups AS (
          SELECT merchant_id, MAX(created_at) AS last_top_up
          FROM credit_transactions
          WHERE type IN ('GRANT', 'ADJUSTMENT') AND amount > 0
          GROUP BY merchant_id
        )
        SELECT m.id,
               m.business_name AS "businessName",
               m.credits_balance::text AS "creditsBalance",
               COALESCE(c.consumed, 0)::text AS "consumed30d",
               t.last_top_up AS "lastTopUp"
        FROM merchants m
        LEFT JOIN consumed c ON c.merchant_id = m.id
        LEFT JOIN topups t ON t.merchant_id = m.id
        WHERE m.deleted_at IS NULL
          AND (${pattern}::text IS NULL OR m.business_name ILIKE ${pattern})
        ORDER BY COALESCE(c.consumed, 0) DESC, m.created_at DESC
        LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
      `,
      this.prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*)::int AS count
        FROM merchants m
        WHERE m.deleted_at IS NULL
          AND (${pattern}::text IS NULL OR m.business_name ILIKE ${pattern})
      `,
    ]);

    const total = countRows[0]?.count ?? 0;

    return {
      merchants: rows.map((row) => ({
        merchantId: row.id,
        businessName: row.businessName,
        creditsBalance: row.creditsBalance,
        consumed30d: row.consumed30d,
        lastTopUp: row.lastTopUp ? row.lastTopUp.toISOString() : null,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      since: since.toISOString(),
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
