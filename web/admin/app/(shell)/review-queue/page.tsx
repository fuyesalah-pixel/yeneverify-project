import Link from 'next/link';
import { loadPageData } from '@/lib/backend';
import type { ReviewQueueResponse } from '@/lib/types';
import { Card, DataError } from '@/components/ui';
import { Pagination } from '@/components/pagination';
import { FlashToast } from '@/components/flash-toast';
import { ReviewQueueTable } from '@/components/review-queue-table';

export const metadata = { title: 'Review queue' };

export default async function ReviewQueuePage({
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

  const result = await loadPageData<ReviewQueueResponse>(
    `/admin/verifications/review-queue?${qs.toString()}`,
    '/review-queue',
  );

  return (
    <main className="p-6 md:p-8">
      <FlashToast notice={searchParams.notice} error={searchParams.error} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Review queue</h1>
          <p className="mt-1 text-sm text-slate-600">
            Verifications flagged NEEDS_REVIEW. Open one to see the receipt, OCR text and adapter
            result before deciding.
          </p>
        </div>
        {result.ok && (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            {result.data.total.toLocaleString('en-GB')} waiting
          </span>
        )}
      </div>

      <form method="GET" action="/review-queue" className="mt-5 flex flex-wrap gap-2">
        <input
          name="search"
          defaultValue={search}
          placeholder="Search merchant or reference…"
          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand sm:w-72"
        />
        <button
          type="submit"
          className="h-9 rounded-lg bg-brand px-4 text-sm font-medium text-white transition hover:bg-brand-dark"
        >
          Search
        </button>
        {search && (
          <Link
            href="/review-queue"
            className="flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 hover:bg-slate-50"
          >
            Clear
          </Link>
        )}
      </form>

      <Card className="mt-5 !p-0">
        {!result.ok ? (
          <div className="p-6">
            <DataError message={result.message} />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <ReviewQueueTable rows={result.data.verifications} />
            </div>
            <div className="border-t border-slate-100 px-4 py-3">
              <Pagination
                basePath="/review-queue"
                params={search ? { search } : {}}
                page={result.data.page}
                pageSize={result.data.pageSize}
                total={result.data.total}
                totalPages={result.data.totalPages}
              />
            </div>
          </>
        )}
      </Card>
    </main>
  );
}
