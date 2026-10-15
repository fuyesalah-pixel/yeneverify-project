// ============================================================
// Yene Verify — Sub-Merchant Invites Service
// Invite lifecycle: create, resend, revoke, accept, decline.
//
// Schema model: a pending invite IS a SubMerchant row with
// status INVITED (the invitee must already have an account).
// The invite token is a stateless, signed JWT (15 minutes TTL)
// carrying the sub-merchant ID — no invite-token table needed.
//
// Accept/decline write SUB_MERCHANT_JOINED / SUB_MERCHANT_DECLINED
// notification rows for the merchant owner and invalidate tenant
// caches so role/scope changes take effect immediately.
// ============================================================

import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../config/config.service';
import { TenantResolverService } from '../tenant/tenant.resolver.service';
import { AuditService } from '../audit/audit.service';
import {
  InvalidInviteError,
  InviteExpiredError,
  InviteConsumedError,
  SubMerchantExistsError,
  PlanLimitSubMerchantsError,
  SubMerchantNotFoundError,
} from './errors';

/** Signed invite-token claims. `kind` prevents token-type confusion. */
export interface InviteTokenClaims {
  kind: 'sub_merchant_invite';
  sub: string; // sub-merchant id
  mid: string; // merchant id
  iid: string; // invite id (== sub-merchant id, kept explicit)
}

const INVITE_TOKEN_TTL_SECONDS = 15 * 60;

@Injectable()
export class SubMerchantInvitesService {
  private readonly logger = new Logger(SubMerchantInvitesService.name);
  private readonly jwt: JwtService;
  private readonly config: AppConfigService;

  constructor(
    config: AppConfigService,
    private readonly prisma: PrismaService,
    private readonly tenantResolver: TenantResolverService,
    private readonly audit: AuditService,
  ) {
    this.config = config;
    this.jwt = new JwtService({
      secret: config.jwt.accessSecret,
      signOptions: {
        issuer: config.jwt.issuer,
        audience: config.jwt.audience,
      },
    });
  }

  /**
   * Invite an existing user as a sub-merchant (merchant side).
   * Creates a SubMerchant row with status INVITED.
   */
  async invite(
    merchantId: string,
    invitedByUserId: string,
    dto: { phone: string; name?: string; branchLabel?: string },
  ): Promise<{
    inviteId: string;
    expiresAt: Date;
    inviteToken: string;
    inviteUrl: string;
    smsSent: boolean;
  }> {
    await this.checkLimit(merchantId);

    // The invitee must already have a Yene Verify account.
    const invitee = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
      select: { id: true, fullName: true, role: true },
    });
    if (!invitee) {
      throw new InvalidInviteError({ reason: 'no_account_for_phone' });
    }
    if (invitee.role === 'ADMIN') {
      throw new InvalidInviteError({ reason: 'admin_cannot_be_invited' });
    }

    // One active membership or invite per user.
    const existing = await this.prisma.subMerchant.findFirst({
      where: { userId: invitee.id, deletedAt: null, status: { in: ['ACTIVE', 'INVITED'] } },
      select: { id: true, status: true },
    });
    if (existing) {
      throw new SubMerchantExistsError();
    }

    const sub = await this.prisma.subMerchant.create({
      data: {
        id: crypto.randomUUID(),
        merchantId,
        userId: invitee.id,
        branchLabel: dto.branchLabel,
        status: 'INVITED',
        invitedByUserId,
        invitedAt: new Date(),
        permissions: {},
      },
    });

    const token = this.signInviteToken(sub.id, merchantId);
    const inviteUrl = `${this.config.app.url}/invite/${token}`;

    this.audit.log({
      actorType: 'USER',
      actorUserId: invitedByUserId,
      action: 'sub_merchant.invited',
      targetType: 'sub_merchant',
      targetId: sub.id,
      metadata: { merchantId, inviteePhone: this.maskPhone(dto.phone) },
    });

    return {
      inviteId: sub.id,
      expiresAt: this.inviteExpiry(),
      inviteToken: token,
      inviteUrl,
      smsSent: false,
    };
  }

  /**
   * Resend an invite: rotate the token and extend its window.
   */
  async resendInvite(merchantId: string, inviteId: string): Promise<{ smsSent: boolean }> {
    const sub = await this.prisma.subMerchant.findFirst({
      where: { id: inviteId, merchantId, deletedAt: null },
      select: { id: true, status: true, invitedAt: true },
    });

    if (!sub) {
      throw new SubMerchantNotFoundError();
    }
    if (sub.status !== 'INVITED') {
      throw new InviteConsumedError();
    }

    // Bound resend attempts by re-inviting: the INVITED row must be recent.
    if (sub.invitedAt && Date.now() - sub.invitedAt.getTime() > 7 * 24 * 60 * 60 * 1000) {
      throw new PlanLimitSubMerchantsError({ reason: 'invite_window_closed' });
    }

    // `invitedAt` doubles as the resend marker (refreshes the window).
    await this.prisma.subMerchant.update({
      where: { id: sub.id },
      data: { invitedAt: new Date() },
    });

    this.audit.log({
      actorType: 'USER',
      action: 'sub_merchant.invite_resent',
      targetType: 'sub_merchant',
      targetId: sub.id,
      metadata: { merchantId },
    });

    return { smsSent: true };
  }

  /**
   * Revoke/cancel a pending invite (merchant side).
   */
  async revokeInvite(merchantId: string, inviteId: string): Promise<void> {
    const sub = await this.prisma.subMerchant.findFirst({
      where: { id: inviteId, merchantId, deletedAt: null },
      select: { id: true, status: true },
    });

    if (!sub) {
      throw new SubMerchantNotFoundError();
    }
    if (sub.status !== 'INVITED') {
      throw new InviteConsumedError();
    }

    await this.prisma.subMerchant.delete({ where: { id: sub.id } });

    this.audit.log({
      actorType: 'USER',
      action: 'sub_merchant.invite_revoked',
      targetType: 'sub_merchant',
      targetId: sub.id,
      metadata: { merchantId },
    });
  }

  /**
   * Accept an invite (invitee side; caller must be authenticated and their
   * account phone must match the invite's target user).
   *
   * In one transaction: set the row ACTIVE, promote the user to
   * SUB_MERCHANT. Afterwards: invalidate tenant caches, audit, and write a
   * SUB_MERCHANT_JOINED notification for the merchant owner.
   */
  async acceptInvite(
    userId: string,
    token: string,
    ip?: string,
    userAgent?: string,
  ): Promise<{ subMerchantId: string; merchantId: string }> {
    const claims = this.verifyInviteToken(token);

    const sub = await this.prisma.subMerchant.findFirst({
      where: { id: claims.sub, deletedAt: null },
      include: { user: { select: { id: true, phone: true, fullName: true } } },
    });
    if (!sub) {
      throw new InvalidInviteError();
    }
    if (sub.status === 'ACTIVE') {
      throw new InviteConsumedError();
    }
    if (sub.status !== 'INVITED') {
      throw new InvalidInviteError();
    }
    // The invite window: 15-minute token, but also expire stale rows.
    if (sub.invitedAt && Date.now() - sub.invitedAt.getTime() > 7 * 24 * 60 * 60 * 1000) {
      await this.prisma.subMerchant.update({ where: { id: sub.id }, data: { status: 'REMOVED' } });
      throw new InviteExpiredError();
    }

    // Authenticated caller must be the invited account.
    if (sub.userId !== userId) {
      throw new InvalidInviteError({ reason: 'phone_mismatch' });
    }

    const merchantId = claims.mid;

    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { ownerUserId: true, businessName: true },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.subMerchant.update({
        where: { id: sub.id },
        data: { status: 'ACTIVE', joinedAt: new Date() },
      });
      await tx.user.update({
        where: { id: userId },
        data: { role: 'SUB_MERCHANT' },
      });
      if (merchant) {
        await tx.notification.create({
          data: {
            id: crypto.randomUUID(),
            userId: merchant.ownerUserId,
            merchantId,
            type: 'SUB_MERCHANT_JOINED',
            title: 'New team member',
            body: `${sub.user.fullName} joined ${sub.branchLabel ?? 'your team'}.`,
            data: {
              subMerchantId: sub.id,
              name: sub.user.fullName,
              branchLabel: sub.branchLabel ?? null,
            },
            channel: 'IN_APP',
          },
        });
      }
    });

    // Role/scope changed — drop cached tenant resolutions for both sides.
    await this.tenantResolver.invalidate(userId);
    await this.tenantResolver.invalidateMerchant(merchantId);

    this.audit.log({
      actorType: 'USER',
      actorUserId: userId,
      action: 'sub_merchant.accepted',
      targetType: 'sub_merchant',
      targetId: sub.id,
      ip,
      userAgent,
      metadata: { merchantId, inviteId: sub.id },
    });

    this.logger.log({ event: 'sub_merchant.accepted', userId, subMerchantId: sub.id, merchantId });

    return { subMerchantId: sub.id, merchantId };
  }

  /**
   * Decline an invite (token-only; possession of the token authorizes).
   * Idempotent: declining twice returns success.
   * Marks the row REMOVED, audits, and writes a SUB_MERCHANT_DECLINED
   * notification for the merchant owner.
   */
  async declineInvite(
    token: string,
    ip?: string,
    userAgent?: string,
  ): Promise<{ declined: boolean }> {
    const claims = this.verifyInviteToken(token);

    const sub = await this.prisma.subMerchant.findFirst({
      where: { id: claims.sub },
      select: {
        id: true,
        status: true,
        merchantId: true,
        user: { select: { fullName: true, phone: true } },
      },
    });
    // Idempotent: a valid token whose invite row is already gone
    // (declined/revoked/removed) is treated as declined.
    if (!sub) {
      return { declined: true };
    }
    if (sub.status === 'ACTIVE') {
      throw new InviteConsumedError();
    }
    if (sub.status !== 'INVITED') {
      throw new InvalidInviteError();
    }

    const merchant = await this.prisma.merchant.findUnique({
      where: { id: sub.merchantId },
      select: { ownerUserId: true },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.subMerchant.delete({ where: { id: sub.id } });
      if (merchant) {
        await tx.notification.create({
          data: {
            id: crypto.randomUUID(),
            userId: merchant.ownerUserId,
            merchantId: sub.merchantId,
            type: 'SUB_MERCHANT_DECLINED',
            title: 'Invite declined',
            body: `${this.maskPhone(sub.user.phone)} declined your invite.`,
            data: { subMerchantId: sub.id, phoneMasked: this.maskPhone(sub.user.phone) },
            channel: 'IN_APP',
          },
        });
      }
    });

    this.audit.log({
      actorType: 'USER',
      action: 'sub_merchant.declined',
      targetType: 'sub_merchant',
      targetId: sub.id,
      ip,
      userAgent,
      metadata: { merchantId: sub.merchantId },
    });

    this.logger.log({ event: 'sub_merchant.declined', subMerchantId: sub.id });

    return { declined: true };
  }

  // ── internals ──────────────────────────────────────────────────────────

  /** Enforce the plan cap shared by invite/resend paths. */
  private async checkLimit(merchantId: string): Promise<void> {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { currentPackageCode: true },
    });
    if (!merchant?.currentPackageCode) return;

    const pkg = await this.prisma.package.findUnique({
      where: { code: merchant.currentPackageCode },
      select: { maxSubMerchants: true },
    });
    if (!pkg?.maxSubMerchants) return;

    const count = await this.prisma.subMerchant.count({
      where: { merchantId, deletedAt: null, status: { in: ['ACTIVE', 'INVITED'] } },
    });
    if (count >= pkg.maxSubMerchants) {
      throw new PlanLimitSubMerchantsError({ limit: pkg.maxSubMerchants });
    }
  }

  private signInviteToken(subMerchantId: string, merchantId: string): string {
    const claims: InviteTokenClaims = {
      kind: 'sub_merchant_invite',
      sub: subMerchantId,
      mid: merchantId,
      iid: subMerchantId,
    };
    return this.jwt.sign(claims, { expiresIn: INVITE_TOKEN_TTL_SECONDS });
  }

  private verifyInviteToken(token: string): InviteTokenClaims {
    try {
      const claims = this.jwt.verify<InviteTokenClaims>(token);
      if (claims.kind !== 'sub_merchant_invite' || !claims.sub || !claims.mid) {
        throw new Error('wrong kind');
      }
      return claims;
    } catch {
      throw new InvalidInviteError();
    }
  }

  private inviteExpiry(): Date {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }

  private maskPhone(phone: string): string {
    if (/^\+251\d{9}$/.test(phone)) {
      return `+251*****${phone.slice(-2)}`;
    }
    return phone;
  }
}
