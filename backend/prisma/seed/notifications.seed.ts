import { PrismaClient } from '@prisma/client';
import { IDS } from './ids';
import { log, daysAgo } from './helpers';
import { newId } from '../../src/common/utils/uuid';

// ── notifications.seed.ts — dev/staging only ─────────────────────────────
// 10 notifications mixing read/unread, push/in-app, all types.

export async function seedNotifications(prisma: PrismaClient): Promise<void> {
  const notifications = [
    // Unread
    {
      userId: IDS.merchant2User, merchantId: IDS.merchant2,
      type: 'CREDIT_LOW' as const, channel: 'PUSH' as const,
      title: 'Credits Running Low',
      body: 'You have 20 credits remaining. Renew your package.',
      data: { threshold: 20 },
      readAt: null, daysBack: 1,
    },
    {
      userId: IDS.merchant1User, merchantId: IDS.merchant1,
      type: 'VERIFICATION_RESULT' as const, channel: 'IN_APP' as const,
      title: 'Payment Needs Review',
      body: 'A Dashen receipt could not be auto-verified. Please review.',
      data: { verificationId: IDS.verificationReview, status: 'NEEDS_REVIEW' },
      readAt: null, daysBack: 3,
    },
    {
      userId: IDS.subMerchant1User, merchantId: IDS.merchant1,
      type: 'VERIFICATION_RESULT' as const, channel: 'IN_APP' as const,
      title: 'Duplicate Receipt Detected',
      body: 'This CBE receipt was already verified by another merchant.',
      data: { verificationId: IDS.verificationDuplicate, status: 'DUPLICATE' },
      readAt: null, daysBack: 5,
    },
    // Read
    {
      userId: IDS.merchant1User, merchantId: IDS.merchant1,
      type: 'BILLING_APPROVED' as const, channel: 'PUSH' as const,
      title: 'Subscription Activated',
      body: 'Your Business package is now active. 400 credits added.',
      data: { subscriptionId: IDS.subscription1, creditsGranted: 400 },
      readAt: daysAgo(14), daysBack: 15,
    },
    {
      userId: IDS.subMerchant1User, merchantId: IDS.merchant1,
      type: 'SUB_MERCHANT_JOINED' as const, channel: 'IN_APP' as const,
      title: 'Welcome to Selam Coffee',
      body: 'You have joined Selam Coffee as a team member at Bole Branch.',
      data: { merchantName: 'Selam Coffee', branchLabel: 'Bole Branch' },
      readAt: daysAgo(18), daysBack: 19,
    },
    {
      userId: IDS.merchant1User, merchantId: IDS.merchant1,
      type: 'VERIFICATION_RESULT' as const, channel: 'IN_APP' as const,
      title: 'Payment Verified',
      body: 'CBE receipt verified successfully.',
      data: { verificationId: IDS.verification1, status: 'VERIFIED' },
      readAt: daysAgo(28), daysBack: 29,
    },
    {
      userId: IDS.subMerchant2User, merchantId: IDS.merchant1,
      type: 'SUB_MERCHANT_JOINED' as const, channel: 'IN_APP' as const,
      title: 'Welcome to Selam Coffee',
      body: 'You have joined Selam Coffee as a team member at Megenagna Branch.',
      data: { merchantName: 'Selam Coffee', branchLabel: 'Megenagna Branch' },
      readAt: daysAgo(13), daysBack: 14,
    },
    {
      userId: IDS.merchant2User, merchantId: IDS.merchant2,
      type: 'VERIFICATION_RESULT' as const, channel: 'PUSH' as const,
      title: 'Fake Receipt Detected',
      body: 'A CBE receipt was not found in bank records.',
      data: { verificationId: IDS.verificationFake1, status: 'FAKE' },
      readAt: daysAgo(7), daysBack: 8,
    },
    {
      userId: IDS.merchant1User, merchantId: IDS.merchant1,
      type: 'SYSTEM' as const, channel: 'IN_APP' as const,
      title: 'New Feature: Analytics',
      body: 'View your peak hours and best-selling products in the Analytics tab.',
      data: { featureKey: 'analytics' },
      readAt: daysAgo(25), daysBack: 26,
    },
    {
      userId: IDS.merchant2User, merchantId: IDS.merchant2,
      type: 'SYSTEM' as const, channel: 'IN_APP' as const,
      title: 'Tips for Better Verification',
      body: 'Take photos in good lighting for faster, more accurate results.',
      data: { tipKey: 'photo_quality' },
      readAt: daysAgo(20), daysBack: 22,
    },
  ];

  let count = 0;
  for (const n of notifications) {
    await prisma.notification.create({
      data: {
        id:         newId(),
        userId:     n.userId,
        merchantId: n.merchantId,
        type:       n.type,
        title:      n.title,
        body:       n.body,
        data:       n.data,
        channel:    n.channel,
        readAt:     n.readAt,
        pushedAt:   n.channel === 'PUSH' ? daysAgo(n.daysBack) : null,
        createdAt:  daysAgo(n.daysBack),
      },
    }).catch(() => { /* Skip if table already has rows from prior seed */ });
    count++;
  }

  log('notifications', count);
}
