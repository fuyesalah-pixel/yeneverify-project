'use server';

// Server actions for the admin console. Each one posts to the backend with the
// admin's own token, then redirects back to the page that submitted the form
// with a flash message, so the UI stays fully server-rendered.

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { mutate, safeReturnPath, withMessage } from './backend';
import type { BlockFingerprintResult, CreditAdjustmentResult } from './types';

const STATUS_MESSAGES: Record<string, string> = {
  SUSPEND: 'Account suspended and sessions revoked.',
  BAN: 'Account banned and sessions revoked.',
  REACTIVATE: 'Account reactivated.',
};

export async function changeUserStatus(formData: FormData): Promise<void> {
  const userId = String(formData.get('userId') ?? '');
  const action = String(formData.get('action') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();
  const returnTo = safeReturnPath(formData.get('returnTo'), `/users/${userId}`);

  if (!STATUS_MESSAGES[action]) {
    redirect(withMessage(returnTo, 'error', 'Unknown status action.'));
  }

  const result = await mutate<{ changed: boolean; status: string }>(
    `/admin/users/${userId}/status`,
    { action, ...(reason ? { reason } : {}) },
    'PATCH',
  );

  if (!result.ok) {
    redirect(withMessage(returnTo, 'error', result.message));
  }

  revalidatePath(`/users/${userId}`);
  revalidatePath('/users');
  redirect(
    withMessage(returnTo, 'notice', result.data.changed ? STATUS_MESSAGES[action] : 'Status already set.'),
  );
}

export async function resetUserPin(formData: FormData): Promise<void> {
  const userId = String(formData.get('userId') ?? '');
  const returnTo = safeReturnPath(formData.get('returnTo'), `/users/${userId}`);

  const result = await mutate<{ pinSet: boolean; sessionsRevoked: number }>(
    `/admin/users/${userId}/pin/reset`,
    {},
  );

  if (!result.ok) {
    redirect(withMessage(returnTo, 'error', result.message));
  }

  revalidatePath(`/users/${userId}`);
  redirect(
    withMessage(
      returnTo,
      'notice',
      `PIN cleared. ${result.data.sessionsRevoked} session(s) revoked.`,
    ),
  );
}

export async function revokeUserDevice(formData: FormData): Promise<void> {
  const userId = String(formData.get('userId') ?? '');
  const deviceId = String(formData.get('deviceId') ?? '');
  const returnTo = safeReturnPath(formData.get('returnTo'), `/users/${userId}`);

  const result = await mutate<{ revoked: boolean; sessionsRevoked: number }>(
    `/admin/users/${userId}/devices/${deviceId}/revoke`,
    {},
  );

  if (!result.ok) {
    redirect(withMessage(returnTo, 'error', result.message));
  }

  revalidatePath(`/users/${userId}`);
  redirect(
    withMessage(
      returnTo,
      'notice',
      result.data.revoked
        ? `Device revoked. ${result.data.sessionsRevoked} session(s) closed.`
        : 'Device was already revoked.',
    ),
  );
}

export async function adjustUserCredits(formData: FormData): Promise<void> {
  const userId = String(formData.get('userId') ?? '');
  const direction = String(formData.get('direction') ?? 'add');
  const reason = String(formData.get('reason') ?? '').trim();
  const rawAmount = String(formData.get('amount') ?? '').trim();
  const returnTo = safeReturnPath(formData.get('returnTo'), `/users/${userId}`);

  const magnitude = Number(rawAmount);
  if (!Number.isFinite(magnitude) || !Number.isInteger(magnitude) || magnitude <= 0) {
    redirect(withMessage(returnTo, 'error', 'Enter a whole number of credits greater than zero.'));
  }
  if (reason.length < 3) {
    redirect(withMessage(returnTo, 'error', 'Give a reason of at least 3 characters.'));
  }
  if (!userId) {
    redirect(withMessage(returnTo, 'error', 'No user selected.'));
  }

  const signed = direction === 'remove' ? -magnitude : magnitude;

  const result = await mutate<CreditAdjustmentResult & { userId: string }>(
    `/admin/users/${userId}/credits`,
    { amount: signed, reason },
  );

  if (!result.ok) {
    redirect(withMessage(returnTo, 'error', result.message));
  }

  revalidatePath(`/users/${userId}`);
  revalidatePath('/users');
  revalidatePath('/reports');

  const summary = `${signed > 0 ? 'Added' : 'Removed'} ${Math.abs(signed)} credit(s) — balance now ${Number(result.data.newBalance).toLocaleString('en-GB')}.`;
  redirect(withMessage(returnTo, 'notice', summary));
}

const ROLE_LABELS: Record<string, string> = {
  MERCHANT: 'Merchant',
  SUB_MERCHANT: 'Sub-merchant',
};

export async function changeUserRole(formData: FormData): Promise<void> {
  const userId = String(formData.get('userId') ?? '');
  const role = String(formData.get('role') ?? '');
  const reason = String(formData.get('reason') ?? '').trim();
  const returnTo = safeReturnPath(formData.get('returnTo'), `/users/${userId}`);

  if (!ROLE_LABELS[role]) {
    redirect(withMessage(returnTo, 'error', 'Unknown role.'));
  }

  const result = await mutate<{ changed: boolean; role: string }>(
    `/admin/users/${userId}/role`,
    { role, ...(reason ? { reason } : {}) },
    'PATCH',
  );

  if (!result.ok) {
    redirect(withMessage(returnTo, 'error', result.message));
  }

  revalidatePath(`/users/${userId}`);
  revalidatePath('/users');
  redirect(
    withMessage(
      returnTo,
      'notice',
      result.data.changed ? `Role changed to ${ROLE_LABELS[result.data.role]}.` : 'Role already set.',
    ),
  );
}

export async function adjustCredits(formData: FormData): Promise<void> {  const merchantId = String(formData.get('merchantId') ?? '');
  const direction = String(formData.get('direction') ?? 'add');
  const reason = String(formData.get('reason') ?? '').trim();
  const rawAmount = String(formData.get('amount') ?? '').trim();
  const returnTo = safeReturnPath(formData.get('returnTo'), '/credits');

  const magnitude = Number(rawAmount);
  if (!Number.isFinite(magnitude) || !Number.isInteger(magnitude) || magnitude <= 0) {
    redirect(withMessage(returnTo, 'error', 'Enter a whole number of credits greater than zero.'));
  }
  if (reason.length < 3) {
    redirect(withMessage(returnTo, 'error', 'Give a reason of at least 3 characters.'));
  }
  if (!merchantId) {
    redirect(withMessage(returnTo, 'error', 'No merchant selected.'));
  }

  const signed = direction === 'remove' ? -magnitude : magnitude;

  const result = await mutate<CreditAdjustmentResult>('/admin/credits/adjustments', {
    merchantId,
    amount: signed,
    reason,
  });

  if (!result.ok) {
    redirect(withMessage(returnTo, 'error', result.message));
  }

  revalidatePath('/credits');
  revalidatePath('/credits/adjust');
  revalidatePath(`/users`);

  const summary = `${signed > 0 ? 'Added' : 'Removed'} ${Math.abs(signed)} credit(s) — balance now ${result.data.newBalance}.`;
  const destination = returnTo.includes('/credits/adjust')
    ? withMessage(
        withMessage(returnTo, 'notice', summary),
        'done',
        result.data.ledgerTxId,
      )
    : withMessage(returnTo, 'notice', summary);

  redirect(destination);
}

// ── Phase C: broadcast notifications ────────────────────────────────────────

const BROADCAST_TYPES = ['info', 'warning', 'system'] as const;

export async function sendNotification(formData: FormData): Promise<void> {
  const returnTo = safeReturnPath(formData.get('returnTo'), '/notifications');
  const targetType = String(formData.get('targetType') ?? '');
  const role = String(formData.get('role') ?? '');
  const userId = String(formData.get('userId') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  const type = String(formData.get('type') ?? 'info');

  if (!['ALL', 'ROLE', 'USER'].includes(targetType)) {
    redirect(withMessage(returnTo, 'error', 'Choose who should receive this notification.'));
  }
  if (targetType === 'ROLE' && !['MERCHANT', 'SUB_MERCHANT'].includes(role)) {
    redirect(withMessage(returnTo, 'error', 'Choose a role for a role-targeted notification.'));
  }
  if (targetType === 'USER' && !userId) {
    redirect(withMessage(returnTo, 'error', 'Search for and select a user first.'));
  }
  if (title.length < 3 || body.length < 3) {
    redirect(withMessage(returnTo, 'error', 'A title and message of at least 3 characters are required.'));
  }
  if (!BROADCAST_TYPES.includes(type as (typeof BROADCAST_TYPES)[number])) {
    redirect(withMessage(returnTo, 'error', 'Unknown notification type.'));
  }

  const result = await mutate<{
    id: string;
    recipientCount: number;
    rowsWritten: number;
    targetLabel: string;
  }>('/admin/notifications/send', {
    targetType,
    ...(targetType === 'ROLE' ? { role } : {}),
    ...(targetType === 'USER' ? { userId } : {}),
    title,
    body,
    type,
  });

  if (!result.ok) {
    redirect(withMessage(returnTo, 'error', result.message));
  }

  revalidatePath('/notifications');
  const { targetLabel, rowsWritten, recipientCount } = result.data;
  const summary =
    rowsWritten === recipientCount
      ? `Sent to ${rowsWritten} recipient(s) — ${targetLabel}.`
      : `Sent to ${rowsWritten} of ${recipientCount} recipient(s) — ${targetLabel}. The rest failed and are logged.`;
  redirect(withMessage(returnTo, 'notice', summary));
}

// ── Phase C: verification review ────────────────────────────────────────────

export async function reviewVerificationDecision(formData: FormData): Promise<void> {
  const verificationId = String(formData.get('verificationId') ?? '');
  const decision = String(formData.get('decision') ?? '');
  const note = String(formData.get('note') ?? '').trim();
  const returnTo = safeReturnPath(formData.get('returnTo'), '/review-queue');

  if (decision !== 'APPROVE' && decision !== 'REJECT') {
    redirect(withMessage(returnTo, 'error', 'Unknown review decision.'));
  }
  if (note.length < 3) {
    redirect(withMessage(returnTo, 'error', 'A note of at least 3 characters is required.'));
  }

  const result = await mutate<{ id: string; status: string }>(
    `/admin/verifications/${verificationId}/review`,
    { decision, note },
  );

  if (!result.ok) {
    redirect(withMessage(returnTo, 'error', result.message));
  }

  revalidatePath('/review-queue');
  revalidatePath(`/review-queue/${verificationId}`);
  revalidatePath('/dashboard');
  revalidatePath('/fraud');

  redirect(
    withMessage(
      '/review-queue',
      'notice',
      decision === 'APPROVE'
        ? 'Verification approved as VERIFIED.'
        : 'Verification rejected as FAKE.',
    ),
  );
}

// ── Phase D: fraud ──────────────────────────────────────────────────────────

const FINGERPRINT = /^[0-9a-f]{64}$/i;

export async function blockReceiptFingerprint(formData: FormData): Promise<void> {
  const fingerprint = String(formData.get('fingerprint') ?? '').trim();
  const returnTo = safeReturnPath(formData.get('returnTo'), '/fraud');

  if (!FINGERPRINT.test(fingerprint)) {
    redirect(withMessage(returnTo, 'error', 'Unknown receipt fingerprint.'));
  }

  const result = await mutate<BlockFingerprintResult>(
    `/admin/fraud/duplicates/${fingerprint.toLowerCase()}/block`,
    {},
  );

  if (!result.ok) {
    redirect(withMessage(returnTo, 'error', result.message));
  }

  revalidatePath('/fraud');
  redirect(
    withMessage(
      returnTo,
      'notice',
      result.data.alreadyBlocked
        ? 'That fingerprint was already blocked.'
        : 'Fingerprint blocked — future verifications of this receipt will be rejected as FAKE.',
    ),
  );
}
