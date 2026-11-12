import Link from 'next/link';
import { loadPageData } from '@/lib/backend';
import type { FraudDuplicatesResponse } from '@/lib/types';
import { Card, DataError } from '@/components/ui';
import { Pagination } from '@/components/pagination';
import { FlashToast } from '@/components/flash-toast';
import { FraudDuplicatesTable } from '@/components/fraud-duplicates-table';

export const metadata = { title: 'Fraud & duplicates' };

export default async function FraudPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const search = searchParams.search ?? '';

  const qs = new URLSearchParams();
  qs.set('page', String(page));
  qs.set('pageSize', '20');
  if (search) qs.set('search', search);

  const result = await loadPageData<FraudDuplicatesResponse>(
    `/admin/fraud/duplicates?${qs.toString()}`,
    '/fraud',
  );

  const params: Record<string, string> = {};
  if (search) params.search = search;

  return (
    <main className="p-6 md:p-8">
      <FlashToast notice={searchParams.notice} error={searchParams.error} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Fraud & duplicates</h1>
          <p className="mt-1 text-sm text-slate-600">
            Receipts reused across verifications, flagged when 3+ merchants submitted the same
            receipt within 24 hours. Click a row to see who used it.
          </p>
        </div>
        {result.ok && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {result.data.total.toLocaleString('en-GB')} flagged receipt(s)
            </span>
            {result.data.suspiciousCount > 0 && (
              <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
                {result.data.suspiciousCount} suspicious on this page
              </span>
            )}
          </div>
        )}
      </div>

      <form method="GET" action="/fraud" className="mt-5 flex flex-wrap gap-2">
        <input
          name="search"
          defaultValue={search}
          placeholder="Search fingerprint, reference or merchant…"
          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand sm:w-80"
        />
        <button
          type="submit"
          className="h-9 rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-brand-dark transition"
        >
          Search
        </button>
        {search && (
          <Link
            href="/fraud"
            className="flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 hover:bg-slate-50"
          >
            Clear
          </Link>
        )}
      </form>

      <div className="mt-5">
        <Card
          title="Flagged receipts"
          description="One row per duplicate fingerprint. Blocking a fingerprint rejects future verifications of that receipt."
        >
          {result.ok ? (
            <>
              <FraudDuplicatesTable rows={result.data.duplicates} returnTo="/fraud" />
              <div className="mt-3 border-t border-slate-100 pt-3">
                <Pagination
                  basePath="/fraud"
                  params={params}
                  page={result.data.page}
                  pageSize={result.data.pageSize}
                  total={result.data.total}
                  totalPages={result.data.totalPages}
                />
              </div>
            </>
          ) : (
            <DataError message={result.message} />
          )}
        </Card>
      </div>
    </main>
  );
}
