// Live health proxy for the System Health page.
//
// The browser polls this route; it reads the backend's public liveness and
// readiness probes (the readiness probe returns 503 when a dependency is
// degraded, so the body is kept even on failure) and the admin-only adapter
// list. Tokens stay server-side.

import { NextResponse } from 'next/server';
import { apiCall, refreshAdminSession } from '@/lib/backend';
import { BACKEND_API_URL } from '@/lib/api';
import type { BankAdapterRow, SystemAdaptersResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

const PROBE_TIMEOUT_MS = 5000;

// The backend excludes health from the versioned prefix, so probes live at the
// origin root (`/health`) rather than under `/api/v1`.
const HEALTH_ORIGIN = new URL(BACKEND_API_URL).origin;

interface ProbeBody {
  status?: string;
  uptime?: number;
  details?: Record<string, { status?: string; message?: string }>;
  info?: Record<string, { status?: string; message?: string }>;
  error?: Record<string, { status?: string; message?: string }>;
}

async function probe(path: string): Promise<{ ok: boolean; status: number; body: ProbeBody | null }> {
  try {
    const response = await fetch(`${HEALTH_ORIGIN}${path}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    const body = (await response.json().catch(() => null)) as ProbeBody | null;
    return { ok: response.ok, status: response.status, body };
  } catch {
    return { ok: false, status: 0, body: null };
  }
}

function checkState(
  details: Record<string, { status?: string; message?: string }> | undefined,
  key: string,
): { status: 'ok' | 'degraded' | 'down'; message: string | null } {
  const entry = details?.[key];
  if (!entry) return { status: 'down', message: null };
  if (entry.status === 'up') return { status: 'ok', message: entry.message ?? null };
  if (entry.status === 'degraded') return { status: 'degraded', message: entry.message ?? null };
  return { status: 'down', message: entry.message ?? null };
}

export async function GET(request: Request) {
  const [live, ready] = await Promise.all([probe('/health'), probe('/health/ready')]);

  let adapters: BankAdapterRow[] = [];
  let mockMode = false;
  let adaptersError: string | null = null;

  let adapterResult = await apiCall<SystemAdaptersResponse>('/admin/system/adapters');
  if (!adapterResult.ok && adapterResult.status === 401) {
    const refreshed = await refreshAdminSession();
    if (refreshed) adapterResult = await apiCall<SystemAdaptersResponse>('/admin/system/adapters');
  }
  if (adapterResult.ok) {
    adapters = adapterResult.data.adapters;
    mockMode = adapterResult.data.mockMode;
  } else {
    adaptersError = adapterResult.message;
  }

  const readinessDetails = ready.body?.details ?? ready.body?.info;

  const tunnelConnected = Boolean(
    request.headers.get('cf-ray') ?? request.headers.get('cf-connecting-ip'),
  );

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    api: {
      status: live.body?.status === 'ok' ? 'ok' : 'down',
      uptimeSeconds: typeof live.body?.uptime === 'number' ? live.body.uptime : null,
      httpStatus: live.status,
    },
    readiness: {
      status: ready.ok ? 'ok' : 'degraded',
      httpStatus: ready.status,
    },
    checks: {
      database: checkState(readinessDetails, 'database'),
      redis: checkState(readinessDetails, 'redis'),
      storage: checkState(readinessDetails, 'storage'),
      ocr: checkState(readinessDetails, 'ocr'),
    },
    tunnel: {
      connected: tunnelConnected,
      via: request.headers.get('cf-ray') ? 'Cloudflare Tunnel' : null,
    },
    adapters,
    mockMode,
    adaptersError,
  });
}
