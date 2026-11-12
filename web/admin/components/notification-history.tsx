'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/shadcn/dialog';
import { Badge, EmptyRow, TABLE_CELL, TABLE_HEAD, statusTone } from '@/components/ui';
import { formatDateTime, formatRelative } from '@/lib/format';
import type { NotificationDetailResponse, NotificationHistoryRow } from '@/lib/types';

const TYPE_TONE: Record<string, 'blue' | 'amber' | 'slate'> = {
  info: 'blue',
  warning: 'amber',
  system: 'slate',
};

export function NotificationHistory({ rows }: { rows: NotificationHistoryRow[] }) {
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<NotificationDetailResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!openId) return;
    let cancelled = false;
    setDetail(null);
    setError(null);
    setLoading(true);

    fetch(`/api/admin/notifications/${openId}`)
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (cancelled) return;
        if (!response.ok) setError(payload?.error ?? 'Could not load delivery stats.');
        else setDetail(payload as NotificationDetailResponse);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load delivery stats.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [openId]);

  const campaign = detail?.notification;

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[660px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className={TABLE_HEAD}>Title</th>
              <th className={TABLE_HEAD}>Target</th>
              <th className={TABLE_HEAD}>Recipients</th>
              <th className={TABLE_HEAD}>Sent at</th>
              <th className={TABLE_HEAD}>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.length === 0 ? (
              <EmptyRow colSpan={5}>No notifications sent yet.</EmptyRow>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => setOpenId(row.id)}
                  className="cursor-pointer transition hover:bg-slate-50/70"
                  title="View delivery stats"
                >
                  <td className={TABLE_CELL}>
                    <div className="flex items-center gap-2">
                      <Badge tone={TYPE_TONE[row.type] ?? 'slate'}>{row.type}</Badge>
                      <span className="font-medium text-slate-900">{row.title}</span>
                    </div>
                    <p className="mt-0.5 line-clamp-1 max-w-[28rem] text-[11px] text-slate-500">{row.body}</p>
                  </td>
                  <td className={TABLE_CELL}>
                    <span className="text-slate-700">{row.targetLabel}</span>
                    <p className="text-[11px] text-slate-400">{row.targetType.toLowerCase()}</p>
                  </td>
                  <td className={TABLE_CELL}>{row.recipientCount.toLocaleString('en-GB')}</td>
                  <td className={TABLE_CELL}>
                    <span className="text-slate-600">{formatDateTime(row.sentAt)}</span>
                    <p className="text-[11px] text-slate-400" suppressHydrationWarning>
                      {formatRelative(row.sentAt)}
                    </p>
                  </td>
                  <td className={TABLE_CELL}>
                    <Badge tone={statusTone(row.status)}>{row.status.replaceAll('_', ' ')}</Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={openId !== null} onOpenChange={(open) => !open && setOpenId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Delivery stats</DialogTitle>
            <DialogDescription>
              {campaign ? campaign.title : 'Loading…'}
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <p className="py-6 text-sm text-slate-500">Loading delivery stats…</p>
          ) : error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : campaign && detail ? (
            <div className="space-y-4">
              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {[
                  ['Recipients', campaign.recipientCount],
                  ['Inbox rows', campaign.rowsWritten],
                  ['Push delivered', campaign.delivered],
                  ['Push failed', campaign.failed],
                  ['Read', campaign.read],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</dt>
                    <dd className="mt-0.5 text-lg font-semibold text-slate-900">
                      {Number(value).toLocaleString('en-GB')}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs text-slate-500">
                  {campaign.targetLabel} · sent by {campaign.sentBy} · {formatDateTime(campaign.sentAt)}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{campaign.body}</p>
              </div>

              <div>
                <p className="mb-1 text-xs font-medium text-slate-500">
                  Recipients (first {detail.recipients.length})
                </p>
                <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200">
                  <table className="w-full border-collapse text-xs">
                    <thead className="sticky top-0 bg-white">
                      <tr className="border-b border-slate-100 text-left text-[10px] uppercase tracking-wide text-slate-400">
                        <th className="px-3 py-2">User</th>
                        <th className="px-3 py-2">Push</th>
                        <th className="px-3 py-2">Read</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {detail.recipients.map((recipient) => (
                        <tr key={recipient.userId}>
                          <td className="px-3 py-1.5">
                            <span className="text-slate-800">
                              {recipient.fullName || recipient.phone}
                            </span>
                            {recipient.googleEmail && (
                              <span className="ml-1 text-slate-400">{recipient.googleEmail}</span>
                            )}
                          </td>
                          <td className="px-3 py-1.5">
                            {recipient.pushedAt ? (
                              <Badge tone="green">delivered</Badge>
                            ) : recipient.pushError ? (
                              <Badge tone="red">failed</Badge>
                            ) : (
                              <Badge tone="slate">in-app only</Badge>
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-slate-500">
                            {recipient.readAt ? formatRelative(recipient.readAt) : 'unread'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
