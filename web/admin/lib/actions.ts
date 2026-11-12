'use server';

// Server actions for the admin console. Each one posts to the backend with the
// admin's own token, then redirects back to the page that submitted the form
// with a flash message, so the UI stays fully server-rendered.

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { mutate, safeReturnPath, withMessage } from './backend';
import type { CreditAdjustmentResult } from './types';

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

export async function adjustCredits(formData: FormData): Promise<void> {
  const merchantId = String(formData.get('merchantId') ?? '');
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
