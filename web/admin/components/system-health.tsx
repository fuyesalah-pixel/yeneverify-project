'use client';

import * as React from 'react';
import { Badge, Card, TABLE_CELL, TABLE_HEAD } from '@/components/ui';
import type { BankAdapterRow } from '@/lib/types';

type CheckState = 'ok' | 'degraded' | 'down';

interface Snapshot {
  checkedAt: string;
  api: { status: 'ok' | 'down'; uptimeSeconds: number | null; httpStatus: number };
  readiness: { status: 'ok' | 'degraded'; httpStatus: number };
  checks: {
    database: { status: CheckState; message: string | null };
    redis: { status: CheckState; message: string | null };
    storage: { status: CheckState; message: string | null };
    ocr: { status: CheckState; message: string | null };
  };
  tunnel: { connected: boolean; via: string | null };
  adapters: BankAdapterRow[];
  mockMode: boolean;
  adaptersError: string | null;
}

const POLL_MS = 15_000;

const STATE_TONE: Record<CheckState, 'green' | 'amber' | 'red'> = {
  ok: 'green',
  degraded: 'amber',
  down: 'red',
};

const MODE_TONE: Record<BankAdapterRow['mode'], 'green' | 'amber' | 'slate'> = {
  real: 'green',
  mock: 'amber',
  unconfigured: 'slate',
};

function StateBadge({ status }: { status: CheckState }) {
  return <Badge tone={STATE_TONE[status]}>{status === 'ok' ? 'up' : status}</Badge>;
}

function formatUptime(seconds: number | null): string {
  if (seconds === null) return '—';
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function SystemHealth() {
  const [snapshot, setSnapshot] = React.useState<Snapshot | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    try {
      const response = await fetch('/api/admin/health', { cache: 'no-store' });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload) {
        setError(payload?.error ?? 'Could not read system health.');
      } else {
        setSnapshot(payload as Snapshot);
        setError(null);
      }
    } catch {
      setError('Could not reach the admin API.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const checks = snapshot
    ? [
        {
          label: 'API',
          status: snapshot.api.status as CheckState,
          detail: `Liveness HTTP ${snapshot.api.httpStatus || '—'} · uptime ${formatUptime(
            snapshot.api.uptimeSeconds,
          )}`,
        },
        {
          label: 'Database',
          status: snapshot.checks.database.status,
          detail: snapshot.checks.database.message ?? 'Postgres readiness probe',
        },
        {
          label: 'Redis',
          status: snapshot.checks.redis.status,
          detail: snapshot.checks.redis.message ?? 'Redis readiness probe',
        },
        {
          label: 'OCR',
          status: snapshot.checks.ocr.status,
          detail: snapshot.checks.ocr.message ?? 'OCR provider readiness probe',
        },
        {
          label: 'Storage',
          status: snapshot.checks.storage.status,
          detail: snapshot.checks.storage.message ?? 'Object storage readiness probe',
        },
      ]
    : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Polling every {POLL_MS / 1000}s
          </span>
          {snapshot && <span>Last checked {new Date(snapshot.checkedAt).toLocaleTimeString()}</span>}
        </div>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            void load();
          }}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
        >
          {loading ? 'Checking…' : 'Refresh now'}
        </button>
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {snapshot && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {checks.map((check) => (
              <div
                key={check.label}
                className="rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {check.label}
                  </p>
                  <StateBadge status={check.status} />
                </div>
                <p className="mt-2 break-words text-[11px] text-slate-500">{check.detail}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Cloudflare Tunnel
                </p>
                <Badge tone={snapshot.tunnel.connected ? 'green' : 'amber'}>
                  {snapshot.tunnel.connected ? 'Connected' : 'Not detected'}
                </Badge>
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                {snapshot.tunnel.connected
                  ? `Request arrived through ${snapshot.tunnel.via ?? 'Cloudflare'}.`
                  : 'Request did not carry Cloudflare headers. The Cloudflare API is not queried.'}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Bank adapters
                </p>
                <Badge tone={snapshot.mockMode ? 'amber' : 'green'}>
                  {snapshot.mockMode ? 'mock mode' : 'real mode'}
                </Badge>
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                Mode is read from <code>BANK_ADAPTER_MOCK</code>; endpoint counts come from the
                backend environment.
              </p>
            </div>
          </div>

          <Card
            title="Bank adapters"
            description="The seven verification adapters registered by the engine"
          >
            {snapshot.adaptersError && (
              <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {snapshot.adaptersError}
              </p>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className={TABLE_HEAD}>Bank</th>
                    <th className={TABLE_HEAD}>Code</th>
                    <th className={TABLE_HEAD}>Mode</th>
                    <th className={TABLE_HEAD}>Configuration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {snapshot.adapters.map((adapter) => (
                    <tr key={adapter.code} className="hover:bg-slate-50/60">
                      <td className={TABLE_CELL}>
                        <span className="font-medium text-slate-900">{adapter.name}</span>
                      </td>
                      <td className={TABLE_CELL}>
                        <span className="font-mono text-xs text-slate-600">{adapter.code}</span>
                      </td>
                      <td className={TABLE_CELL}>
                        <Badge tone={MODE_TONE[adapter.mode]}>{adapter.mode}</Badge>
                      </td>
                      <td className={TABLE_CELL}>
                        <span className="text-slate-600">{adapter.detail}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
