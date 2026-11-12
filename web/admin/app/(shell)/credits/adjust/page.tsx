import Link from 'next/link';
import { loadPageData } from '@/lib/backend';
import { adjustCredits } from '@/lib/actions';
import type { MerchantListResponse, CreditAdjustmentResult } from '@/lib/types';
import { formatNumber, truncate } from '@/lib/format';
import { Badge, statusTone, Card, Flash, DataError, EmptyRow, TABLE_HEAD, TABLE_CELL } from '@/components/ui';

export const metadata = { title: 'Manual Credit Adjustment' };

// ── confirmation receipt shown after a successful adjustment ──────────────────

function AdjustmentReceipt({
  ledgerTxId,
  businessName,
  amount,
  previousBalance,
  newBalance,
  reason,
}: {
  ledgerTxId: string;
  businessName: string;
  amount: string;
  previousBalance: string;
  newBalance: string;
  reason: string;
}) {
  const signed = Number(amount);
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-sm">
          ✓
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-emerald-900">Adjustment recorded</p>
          <p className="mt-0.5 text-sm text-emerald-700">{businessName}</p>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-wide text-emerald-600">Amount</dt>
          <dd className={`mt-0.5 font-semibold ${signed >= 0 ? 'text-emerald-800' : 'text-red-700'}`}>
            {signed > 0 ? '+' : ''}{Number(amount).toLocaleString('en-GB')}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-wide text-emerald-600">Previous</dt>
          <dd className="mt-0.5 text-emerald-900">{Number(previousBalance).toLocaleString('en-GB')}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-wide text-emerald-600">New balance</dt>
          <dd className="mt-0.5 font-semibold text-emerald-900">{Number(newBalance).toLocaleString('en-GB')}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-wide text-emerald-600">Reason</dt>
          <dd className="mt-0.5 truncate text-emerald-900">{reason}</dd>
        </div>
      </dl>
      <p className="mt-3 font-mono text-[11px] text-emerald-600">Ledger tx: {ledgerTxId}</p>
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

export default async function CreditAdjustPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const search = searchParams.search ?? '';
  const preselectedMerchantId = searchParams.merchantId ?? '';
  const notice = searchParams.notice;
  const error = searchParams.error;
  // After a successful adjustment, the action appends done=<ledgerTxId>
  // We use 'done' as a flag but we can't decode the full result from URL alone,
  // so we show the notice message which the action already built.
  const done = searchParams.done;

  // Merchant search results (shown when searching or preselecting)
  const merchantsResult = (search || preselectedMerchantId)
    ? await loadPageData<MerchantListResponse>(
        `/admin/merchants?search=${encodeURIComponent(search || '')}&pageSize=10`,
        '/credits/adjust',
      )
    : null;

  // If a merchantId is preselected, find it in the results
  const preselected =
    preselectedMerchantId && merchantsResult?.ok
      ? (merchantsResult.data.merchants.find((m) => m.id === preselectedMerchantId) ?? null)
      : null;

  // If navigated here directly with a merchantId but no search, do a targeted fetch
  const targetedResult =
    preselectedMerchantId && !search && !preselected
      ? await loadPageData<MerchantListResponse>(
          `/admin/merchants?search=${encodeURIComponent(preselectedMerchantId)}&pageSize=1`,
          '/credits/adjust',
        )
      : null;

  const resolvedMerchant =
    preselected ??
    (targetedResult?.ok ? (targetedResult.data.merchants[0] ?? null) : null);

  return (
    <main className="p-6 md:p-8 max-w-3xl">
      {/* breadcrumb */}
      <Link href="/reports" className="mb-4 inline-block text-xs font-medium text-brand-dark hover:underline">
        ← Back to Reports & Credits
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Manual Credit Adjustment</h1>
          <p className="mt-1 text-sm text-slate-600">
            Search a merchant, enter the amount, and confirm. Every adjustment is written to the
            immutable ledger and audit-logged.
          </p>
        </div>
      </div>

      <Flash notice={notice} error={error} />

      {/* Step 1 — merchant search */}
      <div className="mt-6">
        <Card title="Step 1 — Find merchant">
          <form method="GET" action="/credits/adjust" className="flex gap-2">
            {/* preserve existing merchantId during a fresh search */}
            {preselectedMerchantId && (
              <input type="hidden" name="merchantId" value={preselectedMerchantId} />
            )}
            <input
              name="search"
              defaultValue={search}
              placeholder="Business name, owner name or phone…"
              className="h-9 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
            <button
              type="submit"
              className="h-9 rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-brand-dark transition"
            >
              Search
            </button>
            {(search || preselectedMerchantId) && (
              <Link
                href="/credits/adjust"
                className="flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 hover:bg-slate-50"
              >
                Clear
              </Link>
            )}
          </form>

          {/* results table */}
          {merchantsResult && (
            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
              {!merchantsResult.ok ? (
                <DataError message={merchantsResult.message} />
              ) : (
                <table className="w-full min-w-[500px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/60">
                      <th className={TABLE_HEAD}>Business</th>
                      <th className={TABLE_HEAD}>Owner</th>
                      <th className={TABLE_HEAD}>Balance</th>
                      <th className={TABLE_HEAD}>Package</th>
                      <th className={TABLE_HEAD}>Status</th>
                      <th className={TABLE_HEAD}></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {merchantsResult.data.merchants.length === 0 ? (
                      <EmptyRow colSpan={6}>No merchants found for &ldquo;{search}&rdquo;.</EmptyRow>
                    ) : (
                      merchantsResult.data.merchants.map((m) => {
                        const isSelected = m.id === preselectedMerchantId;
                        return (
                          <tr
                            key={m.id}
                            className={isSelected ? 'bg-brand/5' : 'hover:bg-slate-50/60'}
                          >
                            <td className={TABLE_CELL}>
                              <span className={`font-medium ${isSelected ? 'text-brand-dark' : 'text-slate-900'}`}>
                                {m.businessName}
                              </span>
                            </td>
                            <td className={TABLE_CELL}>
                              <span className="text-slate-700">{m.owner.fullName}</span>
                              <p className="text-[11px] text-slate-400">{m.owner.phone}</p>
                            </td>
                            <td className={TABLE_CELL}>
                              {Number(m.creditsBalance).toLocaleString('en-GB')}
                            </td>
                            <td className={TABLE_CELL}>
                              {m.packageCode ? (
                                <Badge tone="blue">{m.packageCode.replace('_', ' ')}</Badge>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className={TABLE_CELL}>
                              <Badge tone={statusTone(m.status)}>{m.status}</Badge>
                            </td>
                            <td className={TABLE_CELL}>
                              {isSelected ? (
                                <span className="text-xs font-medium text-brand-dark">Selected ✓</span>
                              ) : (
                                <Link
                                  href={`/credits/adjust?merchantId=${m.id}&search=${encodeURIComponent(search)}`}
                                  className="text-xs font-medium text-brand-dark hover:underline"
                                >
                                  Select
                                </Link>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Step 2 — adjustment form (shown only when a merchant is selected) */}
      {resolvedMerchant && (
        <div className="mt-5">
          <Card title="Step 2 — Enter adjustment">
            {/* selected merchant summary */}
            <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-brand/20 bg-brand/5 p-3">
              <div>
                <p className="text-sm font-semibold text-brand-dark">{resolvedMerchant.businessName}</p>
                <p className="text-xs text-slate-500">
                  {resolvedMerchant.owner.fullName} · {resolvedMerchant.owner.phone}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-900">
                  {Number(resolvedMerchant.creditsBalance).toLocaleString('en-GB')} credits
                </p>
                <p className="text-xs text-slate-500">current balance</p>
              </div>
            </div>

            <form action={adjustCredits} className="space-y-4">
              <input type="hidden" name="merchantId" value={resolvedMerchant.id} />
              <input
                type="hidden"
                name="returnTo"
                value={`/credits/adjust?merchantId=${resolvedMerchant.id}&search=${encodeURIComponent(search)}`}
              />

              {/* direction */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Direction
                </label>
                <div className="flex gap-3">
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm has-[:checked]:border-brand/40 has-[:checked]:bg-brand/5">
                    <input type="radio" name="direction" value="add" defaultChecked className="accent-brand" />
                    <span className="text-emerald-700 font-medium">+ Add credits</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm has-[:checked]:border-red-200 has-[:checked]:bg-red-50">
                    <input type="radio" name="direction" value="remove" className="accent-red-500" />
                    <span className="text-red-700 font-medium">− Remove credits</span>
                  </label>
                </div>
              </div>

              {/* amount */}
              <div>
                <label
                  htmlFor="amount"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  Amount (whole credits)
                </label>
                <input
                  id="amount"
                  name="amount"
                  type="number"
                  min="1"
                  step="1"
                  required
                  placeholder="e.g. 50"
                  className="h-10 w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                />
                <p className="mt-1 text-xs text-slate-400">
                  Whole numbers only. Max ±1,000,000 per adjustment.
                </p>
              </div>

              {/* reason */}
              <div>
                <label
                  htmlFor="reason"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="reason"
                  name="reason"
                  required
                  minLength={3}
                  maxLength={500}
                  rows={3}
                  placeholder="e.g. Compensation for downtime on 10 Nov 2026"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                />
                <p className="mt-1 text-xs text-slate-400">
                  Required. This is written verbatim to the audit log.
                </p>
              </div>

              {/* confirm */}
              <div className="border-t border-slate-100 pt-4">
                <button
                  type="submit"
                  className="rounded-lg bg-brand px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-dark transition"
                >
                  Confirm adjustment
                </button>
                <p className="mt-2 text-xs text-slate-400">
                  This action is immediately posted to the immutable ledger and cannot be undone —
                  only corrected with a reverse adjustment.
                </p>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Step 3 — confirmation receipt (shown after redirect with ?done=txId) */}
      {done && notice && (
        <div className="mt-5">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <p className="font-semibold text-emerald-900">✓ {notice}</p>
            <p className="mt-1 font-mono text-xs text-emerald-600">Ledger tx: {done}</p>
            <div className="mt-3 flex gap-3">
              <Link
                href="/reports"
                className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-50 transition"
              >
                View credits overview
              </Link>
              <Link
                href="/credits/adjust"
                className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-dark transition"
              >
                New adjustment
              </Link>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
