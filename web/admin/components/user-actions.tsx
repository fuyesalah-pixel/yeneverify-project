'use client';

import * as React from 'react';
import { useFormStatus } from 'react-dom';
import { Button, type ButtonProps } from '@/components/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/shadcn/dialog';
import {
  adjustUserCredits,
  changeUserRole,
  changeUserStatus,
  resetUserPin,
} from '@/lib/actions';

type Action = (formData: FormData) => Promise<void>;

function SubmitButton({
  label,
  variant = 'default',
}: {
  label: string;
  variant?: ButtonProps['variant'];
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {pending ? 'Working…' : label}
    </Button>
  );
}

function ActionDialog({
  trigger,
  title,
  description,
  confirmLabel,
  confirmVariant = 'default',
  action,
  children,
}: {
  trigger: React.ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  confirmVariant?: ButtonProps['variant'];
  action: Action;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form action={action} onSubmit={() => setOpen(false)} className="space-y-3">
          {children}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton label={confirmLabel} variant={confirmVariant} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const INPUT =
  'h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand';

// ── status ───────────────────────────────────────────────────────────────────

const STATUS_COPY: Record<
  'SUSPEND' | 'BAN' | 'REACTIVATE',
  { title: string; description: string; confirm: string; variant: ButtonProps['variant']; trigger: string }
> = {
  SUSPEND: {
    title: 'Suspend this account?',
    description:
      'The user and their merchant are suspended and every active session is revoked. Credits are untouched.',
    confirm: 'Suspend account',
    variant: 'warning',
    trigger: 'Suspend',
  },
  BAN: {
    title: 'Ban this account?',
    description:
      'The user and their merchant are banned and every active session is revoked. This is reversible only by reactivating the account.',
    confirm: 'Ban account',
    variant: 'destructive',
    trigger: 'Ban',
  },
  REACTIVATE: {
    title: 'Reactivate this account?',
    description: 'Restores the user and their merchant to active. They will be able to sign in again.',
    confirm: 'Reactivate',
    variant: 'default',
    trigger: 'Reactivate',
  },
};

export function StatusActionButton({
  userId,
  returnTo,
  action,
}: {
  userId: string;
  returnTo: string;
  action: 'SUSPEND' | 'BAN' | 'REACTIVATE';
}) {
  const copy = STATUS_COPY[action];

  return (
    <ActionDialog
      trigger={
        <Button variant={copy.variant} size="sm">
          {copy.trigger}
        </Button>
      }
      title={copy.title}
      description={copy.description}
      confirmLabel={copy.confirm}
      confirmVariant={copy.variant}
      action={changeUserStatus}
    >
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="action" value={action} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <label className="block">
        <span className="text-xs font-medium text-slate-500">Reason (optional)</span>
        <input name="reason" maxLength={500} placeholder="Shown in the audit log" className={INPUT} />
      </label>
    </ActionDialog>
  );
}

// ── PIN reset ────────────────────────────────────────────────────────────────

export function ResetPinButton({ userId, returnTo }: { userId: string; returnTo: string }) {
  return (
    <ActionDialog
      trigger={
        <Button variant="outline" size="sm">
          Reset PIN
        </Button>
      }
      title="Reset this user's PIN?"
      description="The PIN is cleared and every session is revoked. The user must set a new PIN on their next sign-in."
      confirmLabel="Reset PIN"
      confirmVariant="destructive"
      action={resetUserPin}
    >
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="returnTo" value={returnTo} />
    </ActionDialog>
  );
}

// ── credits ──────────────────────────────────────────────────────────────────

export function AdjustCreditsButton({
  userId,
  returnTo,
  balance,
}: {
  userId: string;
  returnTo: string;
  balance: string | null;
}) {
  const [direction, setDirection] = React.useState<'add' | 'remove'>('add');

  return (
    <ActionDialog
      trigger={
        <Button size="sm" variant="outline" className="border-brand/30 bg-brand/5 text-brand-dark hover:bg-brand/10">
          Adjust credits
        </Button>
      }
      title="Adjust credits"
      description={
        balance === null
          ? 'This user has no merchant credit balance.'
          : `Current balance: ${Number(balance).toLocaleString('en-GB')} credits.`
      }
      confirmLabel="Apply adjustment"
      confirmVariant={direction === 'remove' ? 'destructive' : 'default'}
      action={adjustUserCredits}
    >
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-medium text-slate-500">Direction</span>
          <select
            name="direction"
            className={INPUT}
            value={direction}
            onChange={(event) => setDirection(event.target.value === 'remove' ? 'remove' : 'add')}
          >
            <option value="add">Add credits</option>
            <option value="remove">Remove credits</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-500">Amount</span>
          <input
            name="amount"
            type="number"
            min={1}
            step={1}
            required
            placeholder="10"
            className={INPUT}
          />
        </label>
      </div>
      <label className="block">
        <span className="text-xs font-medium text-slate-500">Reason</span>
        <input
          name="reason"
          required
          minLength={3}
          maxLength={500}
          placeholder="Why is this adjustment being made?"
          className={INPUT}
        />
      </label>
      {direction === 'remove' && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          Removing credits writes a negative ledger entry and cannot be undone from this screen.
        </p>
      )}
    </ActionDialog>
  );
}

// ── role ─────────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  MERCHANT: 'Merchant',
  SUB_MERCHANT: 'Sub-merchant',
};

export function ChangeRoleButton({
  userId,
  returnTo,
  currentRole,
}: {
  userId: string;
  returnTo: string;
  currentRole: 'MERCHANT' | 'SUB_MERCHANT';
}) {
  const nextRole = currentRole === 'MERCHANT' ? 'SUB_MERCHANT' : 'MERCHANT';

  return (
    <ActionDialog
      trigger={
        <Button variant="ghost" size="sm">
          Change role
        </Button>
      }
      title="Change this user's role?"
      description={`Currently ${ROLE_LABEL[currentRole]}. The target role must already have the matching merchant membership.`}
      confirmLabel="Change role"
      confirmVariant="warning"
      action={changeUserRole}
    >
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <label className="block">
        <span className="text-xs font-medium text-slate-500">New role</span>
        <select name="role" className={INPUT} defaultValue={nextRole}>
          <option value="MERCHANT">Merchant</option>
          <option value="SUB_MERCHANT">Sub-merchant</option>
        </select>
      </label>
      <label className="block">
        <span className="text-xs font-medium text-slate-500">Reason (optional)</span>
        <input name="reason" maxLength={500} placeholder="Shown in the audit log" className={INPUT} />
      </label>
    </ActionDialog>
  );
}
