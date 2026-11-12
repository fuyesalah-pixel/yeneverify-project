'use client';

import * as React from 'react';
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
import { reviewVerificationDecision } from '@/lib/actions';

const COPY: Record<
  'APPROVE' | 'REJECT',
  {
    trigger: string;
    title: string;
    description: string;
    confirm: string;
    variant: ButtonProps['variant'];
    placeholder: string;
  }
> = {
  APPROVE: {
    trigger: 'Approve as verified',
    title: 'Approve this receipt as VERIFIED?',
    description:
      'The verification becomes VERIFIED, a transaction row is projected when the receipt has the details, and one credit is charged.',
    confirm: 'Approve as verified',
    variant: 'default',
    placeholder: 'What evidence confirmed this receipt?',
  },
  REJECT: {
    trigger: 'Reject as fake',
    title: 'Reject this receipt as FAKE?',
    description:
      'The verification becomes FAKE and no credit is charged. The merchant is notified that the receipt could not be verified.',
    confirm: 'Reject as fake',
    variant: 'destructive',
    placeholder: 'Why can this receipt not be verified?',
  },
};

function DecisionDialog({
  verificationId,
  returnTo,
  decision,
}: {
  verificationId: string;
  returnTo: string;
  decision: 'APPROVE' | 'REJECT';
}) {
  const copy = COPY[decision];
  const [open, setOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={copy.variant} size="sm">
          {copy.trigger}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <form
          action={reviewVerificationDecision}
          onSubmit={() => {
            setSubmitting(true);
            setOpen(false);
          }}
          className="space-y-3"
        >
          <input type="hidden" name="verificationId" value={verificationId} />
          <input type="hidden" name="decision" value={decision} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <label className="block">
            <span className="text-xs font-medium text-slate-500">Note (required)</span>
            <textarea
              name="note"
              required
              minLength={3}
              maxLength={500}
              rows={3}
              placeholder={copy.placeholder}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand"
            />
            <span className="mt-1 block text-[11px] text-slate-400">
              Stored on the review record and in the audit log.
            </span>
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant={copy.variant} disabled={submitting}>
              {submitting ? 'Working…' : copy.confirm}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ReviewActions({
  verificationId,
  returnTo,
}: {
  verificationId: string;
  returnTo: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <DecisionDialog verificationId={verificationId} returnTo={returnTo} decision="APPROVE" />
      <DecisionDialog verificationId={verificationId} returnTo={returnTo} decision="REJECT" />
    </div>
  );
}
