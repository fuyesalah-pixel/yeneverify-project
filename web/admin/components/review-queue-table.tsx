'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Badge, EmptyRow, TABLE_CELL, TABLE_HEAD } from '@/components/ui';
import { formatDateTime, formatMoneyMinor } from '@/lib/format';
import type { ReviewQueueRow } from '@/lib/types';

export function ReviewQueueTable({ rows }: { rows: ReviewQueueRow[] }) {
  const router = useRouter();

  return (
    <table className="w-full min-w-[900px] border-collapse text-sm">
      <thead>
        <tr className="border-b border-slate-100">
          <th className={TABLE_HEAD}>Date</th>
          <th className={TABLE_HEAD}>Merchant</th>
          <th className={TABLE_HEAD}>Bank</th>
          <th className={TABLE_HEAD}>Reference</th>
          <th className={TABLE_HEAD}>Amount</th>
          <th className={TABLE_HEAD}>Reason</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-50">
        {rows.length === 0 ? (
          <EmptyRow colSpan={6}>Nothing is waiting for review.</EmptyRow>
        ) : (
          rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => router.push(`/review-queue/${row.id}`)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  router.push(`/review-queue/${row.id}`);
                }
              }}
              tabIndex={0}
              role="link"
              aria-label={`Review verification for ${row.merchant.businessName}`}
              className="cursor-pointer transition hover:bg-slate-50/70 focus:bg-slate-50 focus:outline-none"
            >
              <td className={TABLE_CELL}>
                <span className="text-slate-600">{formatDateTime(row.createdAt)}</span>
              </td>
              <td className={TABLE_CELL}>
                <span className="font-medium text-slate-900">{row.merchant.businessName}</span>
                {row.submittedBy && (
                  <p className="text-[11px] text-slate-400">by {row.submittedBy}</p>
                )}
              </td>
              <td className={TABLE_CELL}>
                {row.bankCode ? (
                  <Badge tone="blue">{row.bankCode}</Badge>
                ) : (
                  <span className="text-slate-400">unknown</span>
                )}
              </td>
              <td className={TABLE_CELL}>
                <span className="font-mono text-xs text-slate-700">{row.bankReference ?? '—'}</span>
              </td>
              <td className={TABLE_CELL}>{formatMoneyMinor(row.amountMinor)}</td>
              <td className={TABLE_CELL}>
                <span className="line-clamp-2 block max-w-[22rem] text-slate-700">{row.reason}</span>
                {row.requestedBy && (
                  <p className="text-[11px] text-slate-400">flagged by {row.requestedBy}</p>
                )}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
