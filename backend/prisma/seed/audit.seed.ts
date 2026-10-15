import { PrismaClient } from '@prisma/client';
import { IDS } from './ids';
import { log, daysAgo } from './helpers';
import { newId } from '../../src/common/utils/uuid';

// ── audit.seed.ts — dev/staging only ─────────────────────────────────────
// 20 audit log entries. Immutable table — uses create with try/catch.
// Never logs PII, only IDs and metadata.

export async function seedAudit(prisma: PrismaClient): Promise<void> {
  const entries = [
    {
      actorType: 'USER' as const, actorUserId: IDS.merchant1User, merchantId: IDS.merchant1,
      action: 'user.login', targetType: 'user', targetId: IDS.merchant1User,
      ip: '10.0.0.1', daysBack: 29,
    },
    {
      actorType: 'USER' as const, actorUserId: IDS.merchant2User, merchantId: IDS.merchant2,
      action: 'user.login', targetType: 'user', targetId: IDS.merchant2User,
      ip: '10.0.0.2', daysBack: 28,
    },
    {
      actorType: 'USER' as const, actorUserId: IDS.subMerchant1User, merchantId: IDS.merchant1,
      action: 'user.login', targetType: 'user', targetId: IDS.subMerchant1User,
      ip: '10.0.0.3', daysBack: 19,
    },
    {
      actorType: 'USER' as const, actorUserId: IDS.subMerchant2User, merchantId: IDS.merchant1,
      action: 'user.login', targetType: 'user', targetId: IDS.subMerchant2User,
      ip: '10.0.0.4', daysBack: 14,
    },
    {
      actorType: 'USER' as const, actorUserId: IDS.merchant1User, merchantId: IDS.merchant1,
      action: 'sub_merchant.invite', targetType: 'sub_merchant', targetId: IDS.subMerchant1,
      ip: '10.0.0.1', daysBack: 20,
    },
    {
      actorType: 'USER' as const, actorUserId: IDS.subMerchant1User, merchantId: IDS.merchant1,
      action: 'sub_merchant.join', targetType: 'sub_merchant', targetId: IDS.subMerchant1,
      ip: '10.0.0.3', daysBack: 19,
    },
    {
      actorType: 'USER' as const, actorUserId: IDS.merchant1User, merchantId: IDS.merchant1,
      action: 'sub_merchant.invite', targetType: 'sub_merchant', targetId: IDS.subMerchant2,
      ip: '10.0.0.1', daysBack: 15,
    },
    {
      actorType: 'USER' as const, actorUserId: IDS.subMerchant2User, merchantId: IDS.merchant1,
      action: 'sub_merchant.join', targetType: 'sub_merchant', targetId: IDS.subMerchant2,
      ip: '10.0.0.4', daysBack: 14,
    },
    {
      actorType: 'USER' as const, actorUserId: IDS.subMerchant1User, merchantId: IDS.merchant1,
      action: 'verification.create', targetType: 'verification', targetId: IDS.verification1,
      ip: '10.0.0.3', daysBack: 29, metadata: { bankCode: 'CBE' },
    },
    {
      actorType: 'SYSTEM' as const, merchantId: IDS.merchant1,
      action: 'verification.complete', targetType: 'verification', targetId: IDS.verification1,
      daysBack: 29, metadata: { status: 'VERIFIED', durationMs: 7800 },
    },
    {
      actorType: 'USER' as const, actorUserId: IDS.merchant2User, merchantId: IDS.merchant2,
      action: 'verification.create', targetType: 'verification', targetId: IDS.verificationFake1,
      ip: '10.0.0.2', daysBack: 8, metadata: { bankCode: 'CBE' },
    },
    {
      actorType: 'SYSTEM' as const, merchantId: IDS.merchant2,
      action: 'verification.complete', targetType: 'verification', targetId: IDS.verificationFake1,
      daysBack: 8, metadata: { status: 'FAKE' },
    },
    {
      actorType: 'USER' as const, actorUserId: IDS.merchant1User, merchantId: IDS.merchant1,
      action: 'billing.submit', targetType: 'billing_verification', targetId: IDS.billingVerif1,
      ip: '10.0.0.1', daysBack: 16,
    },
    {
      actorType: 'SYSTEM' as const, merchantId: IDS.merchant1,
      action: 'billing.approve', targetType: 'billing_verification', targetId: IDS.billingVerif1,
      daysBack: 15, metadata: { packageCode: 'BUSINESS', amountMinor: 99900 },
    },
    {
      actorType: 'SYSTEM' as const, merchantId: IDS.merchant1,
      action: 'subscription.activate', targetType: 'subscription', targetId: IDS.subscription1,
      daysBack: 15, metadata: { packageCode: 'BUSINESS', creditsGranted: 400 },
    },
    {
      actorType: 'SYSTEM' as const, merchantId: IDS.merchant1,
      action: 'credit.grant', targetType: 'subscription', targetId: IDS.subscription1,
      daysBack: 15, metadata: { amount: 400, type: 'GRANT' },
    },
    {
      actorType: 'SYSTEM' as const, merchantId: IDS.merchant1,
      action: 'credit.consume', targetType: 'verification', targetId: IDS.verification1,
      daysBack: 29, metadata: { amount: -1, balanceAfter: 399 },
    },
    {
      actorType: 'USER' as const, actorUserId: IDS.merchant1User, merchantId: IDS.merchant1,
      action: 'verification.review.open', targetType: 'verification', targetId: IDS.verificationReview,
      ip: '10.0.0.1', daysBack: 3,
    },
    {
      actorType: 'SYSTEM' as const, merchantId: IDS.merchant2,
      action: 'duplicate.detected', targetType: 'verification', targetId: IDS.verificationDuplicate,
      daysBack: 5, metadata: { firstMerchantId: IDS.merchant1, bankCode: 'CBE' },
    },
    {
      actorType: 'USER' as const, actorUserId: IDS.merchant2User, merchantId: IDS.merchant2,
      action: 'billing.submit', targetType: 'billing_verification', targetId: IDS.billingVerif2,
      ip: '10.0.0.2', daysBack: 2,
    },
  ];

  let count = 0;
  for (const e of entries) {
    try {
      await prisma.auditLog.create({
        data: {
          id:          newId(),
          actorType:   e.actorType,
          actorUserId: (e as any).actorUserId ?? null,
          merchantId:  e.merchantId,
          action:      e.action,
          targetType:  e.targetType ?? null,
          targetId:    (e as any).targetId ?? null,
          ip:          (e as any).ip ?? null,
          requestId:   newId(),
          metadata:    (e as any).metadata ?? null,
          createdAt:   daysAgo(e.daysBack),
        },
      });
      count++;
    } catch { /* Immutable table — skip if exists */ }
  }

  log('audit-logs', count);
}
