import { loadPageData } from '@/lib/backend';
import type { SubscriptionsOverview } from '@/lib/types';
import {
  Badge,
  Card,
  DataError,
  EmptyRow,
  Stat,
  TABLE_CELL,
  TABLE_HEAD,
  statusTone,
} from '@/components/ui';
import { SubscriptionGrowthChart } from '@/components/subscription-chart';
import { formatDate, formatMoneyMinor, formatNumber } from '@/lib/format';

export const metadata = { title: 'Subscriptions' };

const PLAN_TONE: Record<string, 'slate' | 'blue' | 'green' | 'amber'> = {
  FREE: 'slate',
  PREMIUM: 'blue',
  BUSINESS: 'green',
  BUSINESS_PRO: 'amber',
  API: 'slate',
};

export default async function SubscriptionsPage() {
  const result = await loadPageData<SubscriptionsOverview>(
    '/admin/subscriptions/overview',
    '/subscriptions',
  );

  if (!result.ok) {
    return (
      <main className="p-6 md:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Subscriptions</h1>
        <div className="mt-4">
          <DataError message={result.message} />
        </div>
      </main>
    );
  }

  const d = result.data;
  const churnPct = (d.kpis.churnRate * 100).toFixed(1);
  const activePlans = d.plans.filter((plan) => plan.count > 0);
  const started30d = d.growth.reduce((sum, day) => sum + day.started, 0);

  return (
    <main className="p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Subscriptions</h1>
          <p className="mt-1 text-sm text-slate-600">
            Active subscriptions per plan, monthly recurring revenue, and churn over the trailing
            30 days.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          Since {formatDate(d.since)}
        </span>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <Stat
          label="Total active subscriptions"
          value={formatNumber(d.kpis.activeSubscriptions)}
          note={`${activePlans.length} plan(s) in use`}
          emphasis
        />
        <Stat
          label="Monthly recurring revenue"
          value={formatMoneyMinor(d.kpis.mrrMinor, d.kpis.currency)}
          note="Active plans at list price"
        />
        <Stat
          label="Churn rate (30d)"
          value={`${churnPct}%`}
          note={`${d.kpis.cancelledLast30d} cancelled of ${d.kpis.activeAtStart} active at start`}
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card
          title="Subscription growth"
          description="Last 30 days — cumulative active vs. daily starts"
          className="lg:col-span-2"
        >
          {d.growth.length === 0 ? (
            <p className="text-sm text-slate-400">No subscription history yet.</p>
          ) : (
            <SubscriptionGrowthChart growth={d.growth} />
          )}
          <div className="mt-3 flex flex-wrap gap-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-600" />
              Active now {formatNumber(d.kpis.activeSubscriptions)}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
              Started in 30d {formatNumber(started30d)}
            </span>
            <span className="ml-auto">{d.growth.length} days</span>
          </div>
        </Card>

        <Card title="Plan mix" description="Active subscriptions by package">
          {activePlans.length === 0 ? (
            <p className="text-sm text-slate-400">No active subscriptions.</p>
          ) : (
            <ul className="divide-y divide-slate-50">
              {activePlans.map((plan) => (
                <li key={plan.plan} className="flex items-center justify-between gap-2 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{plan.name}</p>
                    <p className="text-xs text-slate-500">
                      {formatMoneyMinor(plan.priceMinor, d.kpis.currency)} / month
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">
                      {formatNumber(plan.count)}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {formatMoneyMinor(plan.mrrMinor, d.kpis.currency)}
                    </p>
                  </div>
                </li>
              ))}
              <li className="flex items-center justify-between gap-2 pt-2.5">
                <p className="text-sm font-semibold text-slate-900">Total MRR</p>
                <p className="text-sm font-semibold text-brand-dark">
                  {formatMoneyMinor(d.kpis.mrrMinor, d.kpis.currency)}
                </p>
              </li>
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-5">
        <Card
          title="Active subscriptions"
          description={`${formatNumber(d.subscriptions.length)} merchant subscription(s), active first`}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className={TABLE_HEAD}>Merchant name</th>
                  <th className={TABLE_HEAD}>Plan</th>
                  <th className={TABLE_HEAD}>Status</th>
                  <th className={TABLE_HEAD}>Expiry date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {d.subscriptions.length === 0 ? (
                  <EmptyRow colSpan={4}>No merchant subscriptions yet.</EmptyRow>
                ) : (
                  d.subscriptions.map((row) => (
                    <tr key={row.merchantId} className="hover:bg-slate-50/60">
                      <td className={TABLE_CELL}>
                        <span className="font-medium text-slate-900">{row.businessName}</span>
                        {row.merchantStatus !== 'ACTIVE' && (
                          <p className="text-[11px] text-slate-400">
                            merchant {row.merchantStatus.toLowerCase()}
                          </p>
                        )}
                      </td>
                      <td className={TABLE_CELL}>
                        <Badge tone={PLAN_TONE[row.plan] ?? 'slate'}>{row.planName}</Badge>
                      </td>
                      <td className={TABLE_CELL}>
                        <Badge tone={statusTone(row.status)}>
                          {row.status.replaceAll('_', ' ')}
                        </Badge>
                      </td>
                      <td className={TABLE_CELL}>
                        {row.expiresAt ? (
                          <span className="text-slate-600">{formatDate(row.expiresAt)}</span>
                        ) : (
                          <span className="text-slate-400">No expiry</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </main>
  );
}
