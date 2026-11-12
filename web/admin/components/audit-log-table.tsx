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
import { EmptyRow, TABLE_CELL, TABLE_HEAD } from '@/components/ui';
import { formatDateTime, truncate } from '@/lib/format';
import type { AuditLogRow } from '@/lib/types';

function summarise(metadata: unknown): string {
  if (metadata === null || metadata === undefined) return '—';
  if (typeof metadata === 'object' && !Array.isArray(metadata)) {
    const reason = (metadata as Record<string, unknown>).reason;
    if (typeof reason === 'string') return truncate(reason, 60);
  }
  return truncate(JSON.stringify(metadata), 60);
}

function pretty(value: unknown): string {
  if (value === null || value === undefined) return '—';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function AuditLogTable({ rows }: { rows: AuditLogRow[] }) {
  const [selected, setSelected] = React.useState<AuditLogRow | null>(null);

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className={TABLE_HEAD}>Time</th>
              <th className={TABLE_HEAD}>Admin</th>
              <th className={TABLE_HEAD}>Action</th>
              <th className={TABLE_HEAD}>Target</th>
              <th className={TABLE_HEAD}>Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.length === 0 ? (
              <EmptyRow colSpan={5}>No admin actions recorded yet.</EmptyRow>
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
                  aria-label={`View details for ${row.action}`}
                  className="cursor-pointer transition hover:bg-slate-50/70 focus:bg-slate-50 focus:outline-none"
                >
                  <td className={TABLE_CELL}>
                    <span className="text-slate-600">{formatDateTime(row.createdAt)}</span>
                  </td>
                  <td className={TABLE_CELL}>
                    <span className="font-medium text-slate-900">
                      {row.actor.name || row.actor.phone || 'Unknown'}
                    </span>
                    {row.actor.email && (
                      <p className="text-[11px] text-slate-400">{row.actor.email}</p>
                    )}
                  </td>
                  <td className={TABLE_CELL}>
                    <span className="font-mono text-xs text-slate-700">{row.action}</span>
                  </td>
                  <td className={TABLE_CELL}>
                    {row.targetType || row.targetId ? (
                      <>
                        <span className="text-slate-700">{row.targetType ?? 'unknown'}</span>
                        {row.targetId && (
                          <p className="font-mono text-[11px] text-slate-400">
                            {row.targetId.slice(0, 8)}…
                          </p>
                        )}
                      </>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className={TABLE_CELL}>
                    <span className="text-slate-600">{summarise(row.metadata)}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selected?.action ?? 'Audit entry'}</DialogTitle>
            <DialogDescription>
              {selected ? formatDateTime(selected.createdAt) : ''}
              {selected?.actor.email ? ` · ${selected.actor.email}` : ''}
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ['Actor', selected.actor.name || selected.actor.phone || '—'],
                  ['Target', selected.targetType ?? '—'],
                  ['Target id', selected.targetId ?? '—'],
                  ['IP', selected.ip ?? '—'],
                  ['Request id', selected.requestId ?? '—'],
                  ['User agent', selected.userAgent ?? '—'],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2"
                  >
                    <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                      {label}
                    </dt>
                    <dd className="mt-0.5 break-all text-xs text-slate-800">{value}</dd>
                  </div>
                ))}
              </dl>

              <div>
                <p className="mb-1 text-xs font-medium text-slate-500">Metadata</p>
                <pre className="max-h-56 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-700">
                  {pretty(selected.metadata)}
                </pre>
              </div>

              {(selected.before !== null || selected.after !== null) && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="mb-1 text-xs font-medium text-slate-500">Before</p>
                    <pre className="max-h-40 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-700">
                      {pretty(selected.before)}
                    </pre>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium text-slate-500">After</p>
                    <pre className="max-h-40 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-700">
                      {pretty(selected.after)}
                    </pre>
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" size="sm" onClick={() => setSelected(null)}>
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
