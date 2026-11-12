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
import { Badge, EmptyRow, TABLE_CELL, TABLE_HEAD, statusTone } from '@/components/ui';
import { formatDateTime, formatMoneyMinor, truncate } from '@/lib/format';
import { blockReceiptFingerprint } from '@/lib/actions';
import type { FraudDuplicateDetail, FraudDuplicateRow } from '@/lib/types';

export function FraudDuplicatesTable({
  rows,
  returnTo,
}: {
  rows: FraudDuplicateRow[];
  returnTo: string;
}) {
  const [selected, setSelected] = React.useState<FraudDuplicateRow | null>(null);
  const [detail, setDetail] = React.useState<FraudDuplicateDetail | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);

  React.useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setDetail(null);
    setError(null);
    setLoading(true);

    fetch(`/api/admin/fraud/duplicates/${selected.fingerprint}`)
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (cancelled) return;
        if (!response.ok) setError(payload?.error ?? 'Could not load this fingerprint.');
        else setDetail(payload as FraudDuplicateDetail);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load this fingerprint.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selected]);

  const close = () => {
    setSelected(null);
    setDetail(null);
    setError(null);
    setConfirming(false);
  };

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className={TABLE_HEAD}>Reference</th>
              <th className={TABLE_HEAD}>Bank</th>
              <th className={TABLE_HEAD}>Original merchant</th>
              <th className={TABLE_HEAD}>Times used</th>
              <th className={TABLE_HEAD}>First seen</th>
              <th className={TABLE_HEAD}>Last seen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.length === 0 ? (
              <EmptyRow colSpan={6}>No reused receipts found.</EmptyRow>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => setSelected(row)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelected(row);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`View merchants that used ${row.bankReference}`}
                  className="cursor-pointer transition hover:bg-slate-50/70 focus:bg-slate-50 focus:outline-none"
                >
                  <td className={TABLE_CELL}>
                    <span className="font-mono text-xs text-slate-800">{row.bankReference}</span>
                    <div className="mt-1 flex items-center gap-1.5">
                      {row.suspicious && <Badge tone="red">suspicious</Badge>}
                      {row.blockedAt && <Badge tone="slate">blocked</Badge>}
                    </div>
                  </td>
                  <td className={TABLE_CELL}>
                    <Badge tone="blue">{row.bankCode}</Badge>
                  </td>
                  <td className={TABLE_CELL}>
                    <span className="font-medium text-slate-900">
                      {row.firstMerchant.businessName}
                    </span>
                    {row.merchantCount > 1 && (
                      <p className="text-[11px] text-slate-400">
                        {row.merchantCount} merchants involved
                      </p>
                    )}
                  </td>
                  <td className={TABLE_CELL}>
                    <span className="font-medium text-slate-900">{row.uses}</span>
                    <p className="text-[11px] text-slate-400">
                      {row.totalHits} fingerprint {row.totalHits === 1 ? 'hit' : 'hits'}
                    </p>
                  </td>
                  <td className={TABLE_CELL}>
                    <span className="text-slate-600">{formatDateTime(row.firstSeenAt)}</span>
                  </td>
                  <td className={TABLE_CELL}>
                    <span className="text-slate-600">{formatDateTime(row.lastSeenAt)}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={selected !== null} onOpenChange={(open) => !open && close()}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Receipt reuse</DialogTitle>
            <DialogDescription>
              {selected ? (
                <span className="font-mono text-xs">{selected.bankReference}</span>
              ) : (
                'Loading…'
              )}
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ['Bank', selected.bankCode],
                  ['Times used', selected.uses],
                  ['Merchants', selected.merchantCount],
                  ['Blocked', selected.blockedAt ? 'yes' : 'no'],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2"
                  >
                    <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                      {label}
                    </dt>
                    <dd className="mt-0.5 text-sm font-semibold text-slate-900">{value}</dd>
                  </div>
                ))}
              </dl>

              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  Fingerprint
                </p>
                <p className="mt-1 break-all font-mono text-[11px] text-slate-600">
                  {selected.fingerprint}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  First seen {formatDateTime(selected.firstSeenAt)} · last seen{' '}
                  {formatDateTime(selected.lastSeenAt)}
                  {selected.suspicious
                    ? ' · 3+ merchants used this receipt within 24 hours of first sight'
                    : ''}
                </p>
              </div>

              <div>
                <p className="mb-1 text-xs font-medium text-slate-500">Merchants who used it</p>
                {loading ? (
                  <p className="py-4 text-sm text-slate-500">Loading uses…</p>
                ) : error ? (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                  </p>
                ) : detail ? (
                  <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200">
                    <table className="w-full border-collapse text-xs">
                      <thead className="sticky top-0 bg-white">
                        <tr className="border-b border-slate-100 text-left text-[10px] uppercase tracking-wide text-slate-400">
                          <th className="px-3 py-2">Merchant</th>
                          <th className="px-3 py-2">Submitted by</th>
                          <th className="px-3 py-2">Amount</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">When</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {detail.uses.map((use) => (
                          <tr key={use.verificationId}>
                            <td className="px-3 py-1.5 font-medium text-slate-800">
                              {use.merchant}
                            </td>
                            <td className="px-3 py-1.5 text-slate-500">{use.submittedBy}</td>
                            <td className="px-3 py-1.5">{formatMoneyMinor(use.amountMinor)}</td>
                            <td className="px-3 py-1.5">
                              <Badge tone={statusTone(use.status)}>{use.status}</Badge>
                            </td>
                            <td className="px-3 py-1.5 text-slate-500">
                              {formatDateTime(use.createdAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>

              {selected.blockedAt ? (
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  Blocked {formatDateTime(selected.blockedAt)}. New verifications using this
                  receipt are rejected as FAKE.
                </p>
              ) : confirming ? (
                <form action={blockReceiptFingerprint} onSubmit={() => setConfirming(false)}>
                  <input type="hidden" name="fingerprint" value={selected.fingerprint} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                    <p className="text-sm font-medium text-red-700">Block this fingerprint?</p>
                    <p className="mt-1 text-xs text-red-600">
                      Any future verification of {truncate(selected.bankReference, 28)} at{' '}
                      {selected.bankCode} will be rejected as FAKE. This cannot be undone from the
                      dashboard.
                    </p>
                    <div className="mt-3 flex flex-wrap justify-end gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => setConfirming(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" size="sm" className="bg-red-600 hover:bg-red-700">
                        Block fingerprint
                      </Button>
                    </div>
                  </div>
                </form>
              ) : (
                <DialogFooter>
                  <Button type="button" variant="outline" size="sm" onClick={close}>
                    Close
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="bg-red-600 hover:bg-red-700"
                    onClick={() => setConfirming(true)}
                  >
                    Block fingerprint
                  </Button>
                </DialogFooter>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
