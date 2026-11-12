import Link from 'next/link';
import { loadPageData } from '@/lib/backend';
import type { DashboardOverview } from '@/lib/types';
import { Badge, Card, DataError, Stat } from '@/components/ui';
import { VerificationVolumeChart } from '@/components/dashboard-volume-chart';
import { formatDateTime, formatMoneyMinor, formatNumber } from '@/lib/format';

export const metadata = { title: 'Dashboard' };

const ALERT_TONE = {
  pending: 'amber',
  flagged: 'red',
  credits: 'blue',
} as const;

export default async function DashboardPage() {
  const result = await loadPageData<DashboardOverview>('/admin/dashboard/overview', '/dashboard');

  if (!result.ok) {
    return (
      <main className="p-6 md:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <div className="mt-4">
          <DataError message={result.message} />
        </div>
      </main>
    );
  }

  const d = result.data;
  const submitted7d = d.volume.reduce((sum, day) => sum + day.total, 0);
  const verified7d = d.volume.reduce((sum, day) => sum + day.verified, 0);
  const verifyRate = submitted7d > 0 ? Math.round((verified7d / submitted7d) * 100) : 0;

  const alerts = [
    {
      label: 'Pending reviews',
      count: d.alerts.pendingReviews,
      note: 'NEEDS_REVIEW verifications waiting for a decision',
      href: '/review-queue',
      tone: ALERT_TONE.pending,
    },
    {
      label: 'Flagged duplicates',
      count: d.alerts.flaggedDuplicates,
      note: 'Receipts reused by 3+ merchants within 24 hours',
      href: '/fraud',
      tone: ALERT_TONE.flagged,
    },
    {
      label: 'Low-credit merchants',
      count: d.alerts.lowCreditMerchants,
      note: 'Balance at or below the 20-credit warning threshold',
      href: '/reports',
      tone: ALERT_TONE.credits,
    },
  ];

  return (
    <main className="p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Platform metrics, verification trend, and operational alerts.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          Updated {formatDateTime(d.generatedAt)}
        </span>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Total merchants"
          value={formatNumber(d.kpis.totalMerchants)}
          note="Active merchant accounts"
          emphasis
        />
        <Stat
          label="Active subscriptions"
          value={formatNumber(d.kpis.activeSubscriptions)}
          note="Merchants on a current plan"
        />
        <Stat
          label="Verifications today"
          value={formatNumber(d.kpis.verificationsToday)}
          note="All statuses since 00:00 UTC"
        />
        <Stat
          label="Revenue (MRR)"
          value={formatMoneyMinor(d.kpis.mrrMinor, d.kpis.currency)}
          note="Active plans at list price"
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card
          title="Verification volume"
          description="Last 7 days — submitted vs. verified"
          className="lg:col-span-2"
        >
          {d.volume.length === 0 ? (
            <p className="text-sm text-slate-400">No verification history yet.</p>
          ) : (
            <VerificationVolumeChart volume={d.volume} />
          )}
          <div className="mt-3 flex flex-wrap gap-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-brand" />
              Submitted {formatNumber(submitted7d)}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-sky-600" />
              Verified {formatNumber(verified7d)}
            </span>
            <span className="ml-auto">{verifyRate}% verified</span>
          </div>
        </Card>

        <Card title="Alerts" description="Items that may need attention">
          <ul className="space-y-2">
            {alerts.map((alert) => (
              <li key={alert.label}>
                <Link
                  href={alert.href}
                  className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">{alert.label}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">{alert.note}</p>
                  </div>
                  <Badge tone={alert.count > 0 ? alert.tone : 'slate'}>{alert.count}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-5">
        <Card
          title="Recent activity"
          description="Latest admin actions from the audit trail"
          action={
            <Link
              href="/audit"
              className="text-xs font-medium text-brand-dark transition hover:text-brand"
            >
              View audit log →
            </Link>
          }
        >
          {d.recentActivity.length === 0 ? (
            <p className="text-sm text-slate-400">No admin activity recorded yet.</p>
          ) : (
            <ul className="divide-y divide-slate-50">
              {d.recentActivity.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs text-slate-800">{entry.action}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {entry.actorName}
                      {entry.targetType ? ` · ${entry.targetType}` : ''}
                    </p>
                  </div>
                  <span className="text-xs text-slate-500">{formatDateTime(entry.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </main>
  );
}
