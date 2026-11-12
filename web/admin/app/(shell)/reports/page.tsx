import Link from 'next/link';
import { loadPageData } from '@/lib/backend';
import type { CreditsOverview, MerchantCreditStatsResponse } from '@/lib/types';
import { formatDateTime, formatNumber, formatSigned, truncate } from '@/lib/format';
import {
  Badge,
  Card,
  Stat,
  EmptyRow,
  TABLE_HEAD,
  TABLE_CELL,
  DataError,
} from '@/components/ui';
import { Button } from '@/components/shadcn/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/shadcn/table';
import { CreditConsumptionChart } from '@/components/credit-chart';

export const metadata = { title: 'Reports & Credits' };

export default async function ReportsPage() {
  const [result, merchantsResult] = await Promise.all([
    loadPageData<CreditsOverview>('/admin/credits/overview', '/reports'),
    loadPageData<MerchantCreditStatsResponse>('/admin/credits/merchants?pageSize=20', '/reports'),
  ]);

  if (!result.ok) {
    return (
      <main className="p-6 md:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Reports & Credits</h1>
        <div className="mt-4">
          <DataError message={result.message} />
        </div>
      </main>
    );
  }

  const d = result.data;
  const t = d.totals;

  return (
    <main className="p-6 md:p-8">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports & Credits</h1>
          <p className="mt-1 text-sm text-slate-600">
            Platform-wide credit flow and merchant balances.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/credits/adjust">+ Manual adjustment</Link>
        </Button>
      </div>

      {/* KPI strip */}
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <Stat label="Total credits issued" value={formatNumber(t.granted)} note="Lifetime grants" emphasis />
        <Stat label="Total credits consumed" value={formatNumber(t.consumed)} note="Lifetime consumption" />
        <Stat label="Net credits" value={formatNumber(t.netIssued)} note="Issued − consumed − expired" />
      </div>

      {/* chart + low balance */}
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card
          title="Daily credit consumption"
          description="Last 30 days — granted vs consumed"
          className="lg:col-span-2"
        >
          {d.series.length === 0 ? (
            <p className="text-sm text-slate-400">No data yet.</p>
          ) : (
            <CreditConsumptionChart series={d.series} />
          )}
          <div className="mt-3 flex flex-wrap gap-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-brand" />
              Granted {formatNumber(d.seriesTotals.granted)}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
              Consumed {formatNumber(d.seriesTotals.consumed)}
            </span>
            <span className="ml-auto">{d.series.length} days</span>
          </div>
        </Card>

        <Card title="Low balance" description={`≤ threshold · ${d.lowBalance.length} merchants`}>
          {d.lowBalance.length === 0 ? (
            <p className="text-sm text-slate-400">No merchants below threshold.</p>
          ) : (
            <ul className="divide-y divide-slate-50">
              {d.lowBalance.map((m) => (
                <li key={m.merchantId} className="py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {m.businessName}
                      </p>
                      <p className="text-xs text-slate-500">{m.ownerPhone}</p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-sm font-semibold text-amber-600">
                        {Number(m.creditsBalance).toLocaleString('en-GB')} cr
                      </p>
                      {m.packageCode && (
                        <Badge tone="slate">{m.packageCode.replace('_', ' ')}</Badge>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* per-merchant usage */}
      <div className="mt-5">
        <Card
          title="Merchant credit usage"
          description={`Balance, consumption in the last 30 days, and latest top-up${
            merchantsResult.ok ? ` · ${merchantsResult.data.total} merchants` : ''
          }`}
        >
          {!merchantsResult.ok ? (
            <DataError message={merchantsResult.message} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Business name</TableHead>
                  <TableHead>Current balance</TableHead>
                  <TableHead>Consumed (30d)</TableHead>
                  <TableHead>Last top-up</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {merchantsResult.data.merchants.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={4} className="py-8 text-center text-sm text-slate-500">
                      No merchants found.
                    </TableCell>
                  </TableRow>
                ) : (
                  merchantsResult.data.merchants.map((row) => (
                    <TableRow key={row.merchantId}>
                      <TableCell className="font-medium text-slate-900">
                        {row.businessName}
                      </TableCell>
                      <TableCell>
                        {Number(row.creditsBalance).toLocaleString('en-GB')}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-amber-700">
                          {Number(row.consumed30d).toLocaleString('en-GB')}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-slate-500">
                          {row.lastTopUp ? formatDateTime(row.lastTopUp) : '—'}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>

      {/* recent manual adjustments */}
      <div className="mt-5">
        <Card
          title="Recent manual adjustments"
          action={
            <Link href="/credits/adjust" className="text-xs font-medium text-brand-dark hover:underline">
              New adjustment →
            </Link>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className={TABLE_HEAD}>Merchant</th>
                  <th className={TABLE_HEAD}>Amount</th>
                  <th className={TABLE_HEAD}>New balance</th>
                  <th className={TABLE_HEAD}>Reason</th>
                  <th className={TABLE_HEAD}>By</th>
                  <th className={TABLE_HEAD}>Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {d.recentAdjustments.length === 0 ? (
                  <EmptyRow colSpan={6}>No manual adjustments yet.</EmptyRow>
                ) : (
                  d.recentAdjustments.map((adj) => (
                    <tr key={adj.id} className="hover:bg-slate-50/60">
                      <td className={TABLE_CELL}>
                        <span className="font-medium text-slate-900">
                          {adj.businessName ?? '—'}
                        </span>
                      </td>
                      <td className={TABLE_CELL}>
                        <span
                          className={
                            Number(adj.amount) >= 0
                              ? 'font-medium text-emerald-600'
                              : 'font-medium text-red-600'
                          }
                        >
                          {adj.amount !== null ? formatSigned(adj.amount) : '—'}
                        </span>
                      </td>
                      <td className={TABLE_CELL}>
                        {adj.newBalance !== null
                          ? Number(adj.newBalance).toLocaleString('en-GB')
                          : '—'}
                      </td>
                      <td className={TABLE_CELL}>{truncate(adj.reason, 36)}</td>
                      <td className={TABLE_CELL}>{adj.actorName ?? adj.actorEmail ?? '—'}</td>
                      <td className={TABLE_CELL}>{formatDateTime(adj.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <p className="mt-4 text-right text-xs text-slate-400">
        Generated {formatDateTime(d.generatedAt)}
      </p>
    </main>
  );
}
