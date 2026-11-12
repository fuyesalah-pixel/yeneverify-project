'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/shadcn/dialog';
import { Button } from '@/components/shadcn/button';
import { Badge, Card } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import { updateFeatureFlag, updatePaymentInstructions } from '@/lib/actions';
import type { FeatureFlagRow, PaymentInstructions } from '@/lib/types';

const INPUT =
  'h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand';

interface Draft {
  accountName: string;
  cbeAccountNumber: string;
  telebirrPhoneNumber: string;
  instructionsNote: string;
}

const PAYMENT_FIELDS: Array<{ key: keyof Draft; label: string; hint: string }> = [
  { key: 'accountName', label: 'Account name', hint: 'Shown next to both destinations.' },
  { key: 'cbeAccountNumber', label: 'CBE account number', hint: 'Digits only.' },
  {
    key: 'telebirrPhoneNumber',
    label: 'Telebirr phone number',
    hint: 'Include the country code, e.g. +2519…',
  },
  {
    key: 'instructionsNote',
    label: 'Instruction note',
    hint: 'Extra guidance merchants see during billing (optional).',
  },
];

export function PlatformConfig({
  flags,
  payment,
  returnTo,
}: {
  flags: FeatureFlagRow[];
  payment: PaymentInstructions;
  returnTo: string;
}) {
  const [pendingFlag, setPendingFlag] = React.useState<FeatureFlagRow | null>(null);
  const [draft, setDraft] = React.useState<Draft>({
    accountName: payment.accountName,
    cbeAccountNumber: payment.cbeAccountNumber,
    telebirrPhoneNumber: payment.telebirrPhoneNumber,
    instructionsNote: payment.instructionsNote,
  });
  const [confirmingPayment, setConfirmingPayment] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);

  const changes = PAYMENT_FIELDS.map((field) => ({
    label: field.label,
    from: payment[field.key] || '—',
    to: draft[field.key].trim() || '—',
    changed: draft[field.key].trim() !== payment[field.key],
  })).filter((change) => change.changed);

  const reviewPayment = () => {
    if (!formRef.current?.reportValidity()) return;
    setConfirmingPayment(true);
  };

  return (
    <div className="space-y-5">
      <Card
        title="Feature flags"
        description="Changes take effect immediately and are recorded in the audit log."
      >
        <ul className="divide-y divide-slate-50">
          {flags.map((flag) => (
            <li key={flag.key} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-slate-900">{flag.label}</p>
                  <Badge tone={flag.enabled ? 'green' : 'slate'}>
                    {flag.enabled ? 'enabled' : 'disabled'}
                  </Badge>
                  {flag.envDefault !== null && (
                    <span className="text-[11px] text-slate-400">
                      env default {String(flag.envDefault)}
                    </span>
                  )}
                </div>
                <p className="mt-1 max-w-2xl text-xs text-slate-500">{flag.description}</p>
                <p className="mt-1 font-mono text-[11px] text-slate-400">
                  {flag.key}
                  {flag.envKey ? ` · ${flag.envKey}` : ''}
                  {flag.updatedAt ? ` · updated ${formatDateTime(flag.updatedAt)}` : ''}
                </p>
              </div>
              <Button
                type="button"
                variant={flag.enabled ? 'outline' : 'default'}
                size="sm"
                onClick={() => setPendingFlag(flag)}
              >
                {flag.enabled ? 'Disable' : 'Enable'}
              </Button>
            </li>
          ))}
        </ul>
      </Card>

      <Card
        title="Payment instructions"
        description="The CBE and Telebirr destinations merchants see when they buy a plan. Saved changes apply to the next billing session."
      >
        <form
          ref={formRef}
          id="payment-form"
          action={updatePaymentInstructions}
          onSubmit={() => setConfirmingPayment(false)}
          className="space-y-4"
        >
          <input type="hidden" name="returnTo" value={returnTo} />
          <div className="grid gap-4 sm:grid-cols-2">
            {PAYMENT_FIELDS.map((field) => (
              <label key={field.key} className="block">
                <span className="text-xs font-medium text-slate-500">{field.label}</span>
                <input
                  name={field.key}
                  value={draft[field.key]}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, [field.key]: event.target.value }))
                  }
                  required={field.key !== 'instructionsNote'}
                  minLength={field.key === 'accountName' ? 1 : undefined}
                  maxLength={field.key === 'instructionsNote' ? 500 : 120}
                  pattern={
                    field.key === 'cbeAccountNumber'
                      ? '[0-9]{6,32}'
                      : field.key === 'telebirrPhoneNumber'
                        ? '\\+?[0-9]{9,15}'
                        : undefined
                  }
                  inputMode={
                    field.key === 'cbeAccountNumber'
                      ? 'numeric'
                      : field.key === 'telebirrPhoneNumber'
                        ? 'tel'
                        : undefined
                  }
                  className={`${INPUT} mt-1`}
                />
                <span className="mt-1 block text-[11px] text-slate-400">{field.hint}</span>
              </label>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
            <p className="text-[11px] text-slate-500">
              Source: {payment.source === 'db' ? 'saved in the database' : 'environment fallback'}
              {payment.updatedAt ? ` · last saved ${formatDateTime(payment.updatedAt)}` : ''}
            </p>
            <Button type="button" size="sm" onClick={reviewPayment}>
              Review changes
            </Button>
          </div>
        </form>
      </Card>

      <Dialog open={pendingFlag !== null} onOpenChange={(open) => !open && setPendingFlag(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{pendingFlag?.enabled ? 'Disable' : 'Enable'} this flag?</DialogTitle>
            <DialogDescription>{pendingFlag?.label}</DialogDescription>
          </DialogHeader>
          {pendingFlag && (
            <form action={updateFeatureFlag} onSubmit={() => setPendingFlag(null)}>
              <input type="hidden" name="key" value={pendingFlag.key} />
              <input type="hidden" name="enabled" value={String(!pendingFlag.enabled)} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <span className="font-mono">{pendingFlag.key}</span> will be{' '}
                {pendingFlag.enabled ? 'disabled' : 'enabled'} immediately. The change is written to
                the audit log.
              </p>
              <DialogFooter className="mt-4">
                <Button type="button" variant="outline" size="sm" onClick={() => setPendingFlag(null)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  {pendingFlag.enabled ? 'Disable flag' : 'Enable flag'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={confirmingPayment} onOpenChange={setConfirmingPayment}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Save payment instructions?</DialogTitle>
            <DialogDescription>
              Merchants will see these destinations on their next billing session.
            </DialogDescription>
          </DialogHeader>

          {changes.length === 0 ? (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              No changes to save.
            </p>
          ) : (
            <ul className="space-y-2">
              {changes.map((change) => (
                <li
                  key={change.label}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                >
                  <p className="font-medium text-slate-700">{change.label}</p>
                  <p className="mt-0.5 break-all text-slate-500">
                    {change.from} → <span className="font-medium text-slate-800">{change.to}</span>
                  </p>
                </li>
              ))}
            </ul>
          )}

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" size="sm" onClick={() => setConfirmingPayment(false)}>
              Cancel
            </Button>
            <Button type="submit" form="payment-form" size="sm" disabled={changes.length === 0}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
