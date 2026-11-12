'use client';

import * as React from 'react';
import { Button } from '@/components/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/shadcn/dialog';
import { sendNotification } from '@/lib/actions';
import type { NotificationAudience } from '@/lib/types';

type TargetType = 'ALL' | 'ROLE' | 'USER';
type Role = 'MERCHANT' | 'SUB_MERCHANT';
type BroadcastType = 'info' | 'warning' | 'system';

interface PickedUser {
  id: string;
  label: string;
  email: string | null;
  merchant: string | null;
}

const INPUT =
  'h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand';

const TYPE_OPTIONS: Array<{ value: BroadcastType; label: string }> = [
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'system', label: 'System' },
];

function TargetButton({
  active,
  onClick,
  title,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-xl border px-3 py-2 text-left transition ${
        active
          ? 'border-brand bg-brand/5 ring-1 ring-brand/30'
          : 'border-slate-200 bg-white hover:bg-slate-50'
      }`}
    >
      <span className="block text-sm font-medium text-slate-900">{title}</span>
      <span className="mt-0.5 block text-[11px] text-slate-500">{hint}</span>
    </button>
  );
}

export function NotificationComposer({
  audience,
  returnTo,
}: {
  audience: NotificationAudience;
  returnTo: string;
}) {
  const [targetType, setTargetType] = React.useState<TargetType>('ALL');
  const [role, setRole] = React.useState<Role>('MERCHANT');
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<
    Array<{ id: string; fullName: string; googleEmail: string | null; phone: string; merchant: string | null }>
  >([]);
  const [searching, setSearching] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const [picked, setPicked] = React.useState<PickedUser | null>(null);
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [type, setType] = React.useState<BroadcastType>('info');
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (targetType !== 'USER') return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearchError(null);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/admin/users/search?q=${encodeURIComponent(q)}`);
        const payload = await response.json().catch(() => null);
        if (cancelled) return;
        if (!response.ok) {
          setSearchError(payload?.error ?? 'User search failed.');
          setResults([]);
        } else {
          setResults(payload?.users ?? []);
          setSearchError(null);
        }
      } catch {
        if (!cancelled) {
          setSearchError('User search failed.');
          setResults([]);
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 280);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, targetType]);

  const count =
    targetType === 'ALL'
      ? audience.all
      : targetType === 'ROLE'
        ? role === 'MERCHANT'
          ? audience.merchant
          : audience.subMerchant
        : picked
          ? 1
          : 0;

  const targetText =
    targetType === 'ALL'
      ? 'All merchants'
      : targetType === 'ROLE'
        ? role === 'MERCHANT'
          ? 'All merchants (owners)'
          : 'All sub-merchants'
        : picked
          ? `${picked.label}${picked.email ? ` (${picked.email})` : ''}`
          : 'No user selected';

  const canSend =
    count > 0 && title.trim().length >= 3 && body.trim().length >= 3 && (targetType !== 'USER' || Boolean(picked));

  return (
    <form
      id="compose-notification"
      action={sendNotification}
      onSubmit={() => {
        setSubmitting(true);
        setConfirmOpen(false);
      }}
      className="space-y-4"
    >
      <input type="hidden" name="targetType" value={targetType} />
      {targetType === 'ROLE' && <input type="hidden" name="role" value={role} />}
      {targetType === 'USER' && <input type="hidden" name="userId" value={picked?.id ?? ''} />}
      <input type="hidden" name="returnTo" value={returnTo} />

      <div>
        <span className="text-xs font-medium text-slate-500">Recipients</span>
        <div className="mt-1.5 grid gap-2 sm:grid-cols-3">
          <TargetButton
            active={targetType === 'ALL'}
            onClick={() => setTargetType('ALL')}
            title="All merchants"
            hint={`${audience.all} active account(s)`}
          />
          <TargetButton
            active={targetType === 'ROLE'}
            onClick={() => setTargetType('ROLE')}
            title="By role"
            hint={`${audience.merchant} owner(s) · ${audience.subMerchant} sub-merchant(s)`}
          />
          <TargetButton
            active={targetType === 'USER'}
            onClick={() => setTargetType('USER')}
            title="One user"
            hint="Name, phone or email"
          />
        </div>
      </div>

      {targetType === 'ROLE' && (
        <label className="block">
          <span className="text-xs font-medium text-slate-500">Role</span>
          <select
            className={INPUT}
            value={role}
            onChange={(event) => setRole(event.target.value === 'SUB_MERCHANT' ? 'SUB_MERCHANT' : 'MERCHANT')}
          >
            <option value="MERCHANT">Merchants (owners)</option>
            <option value="SUB_MERCHANT">Sub-merchants</option>
          </select>
        </label>
      )}

      {targetType === 'USER' && (
        <div>
          <span className="text-xs font-medium text-slate-500">User</span>
          {picked ? (
            <div className="mt-1 flex items-center justify-between gap-2 rounded-lg border border-brand/30 bg-brand/5 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{picked.label}</p>
                <p className="truncate text-[11px] text-slate-500">
                  {[picked.email, picked.merchant].filter(Boolean).join(' · ') || 'No email or merchant'}
                </p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setPicked(null)}>
                Change
              </Button>
            </div>
          ) : (
            <>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, phone or email…"
                className={`${INPUT} mt-1`}
                autoComplete="off"
              />
              <div className="mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white">
                {query.trim().length < 2 ? (
                  <p className="px-3 py-2 text-xs text-slate-400">Type at least 2 characters.</p>
                ) : searching ? (
                  <p className="px-3 py-2 text-xs text-slate-400">Searching…</p>
                ) : searchError ? (
                  <p className="px-3 py-2 text-xs text-red-600">{searchError}</p>
                ) : results.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-slate-400">No matching users.</p>
                ) : (
                  results.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() =>
                        setPicked({
                          id: user.id,
                          label: user.fullName || user.phone,
                          email: user.googleEmail,
                          merchant: user.merchant,
                        })
                      }
                      className="flex w-full items-center justify-between gap-2 border-b border-slate-50 px-3 py-2 text-left last:border-b-0 hover:bg-slate-50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-slate-800">
                          {user.fullName || user.phone}
                        </span>
                        <span className="block truncate text-[11px] text-slate-500">
                          {[user.googleEmail, user.phone, user.merchant].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      <span className="text-[11px] font-medium text-brand-dark">Select</span>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}

      <label className="block">
        <span className="text-xs font-medium text-slate-500">Title</span>
        <input
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          minLength={3}
          maxLength={120}
          placeholder="Scheduled maintenance tonight"
          className={`${INPUT} mt-1`}
        />
      </label>

      <label className="block">
        <span className="text-xs font-medium text-slate-500">Message</span>
        <textarea
          name="body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          required
          minLength={3}
          maxLength={1000}
          rows={4}
          placeholder="What should merchants know?"
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand"
        />
      </label>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="block">
          <span className="text-xs font-medium text-slate-500">Type</span>
          <select
            name="type"
            className={INPUT}
            value={type}
            onChange={(event) => setType(event.target.value as BroadcastType)}
          >
            {TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <Button type="button" disabled={!canSend} onClick={() => setConfirmOpen(true)}>
          Send notification
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Send to {count.toLocaleString('en-GB')} {count === 1 ? 'recipient' : 'recipients'}?
            </DialogTitle>
            <DialogDescription>
              {targetText}. This goes out immediately and cannot be recalled.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-sm font-medium text-slate-900">{title}</p>
            <p className="whitespace-pre-wrap text-xs text-slate-600">{body}</p>
            <p className="text-[11px] uppercase tracking-wide text-slate-400">{type}</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="compose-notification" disabled={submitting}>
              {submitting ? 'Sending…' : `Send to ${count.toLocaleString('en-GB')}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
