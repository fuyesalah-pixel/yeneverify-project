import Link from 'next/link';
import { loadPageData } from '@/lib/backend';
import type { AuditLogsResponse } from '@/lib/types';
import { Card, DataError } from '@/components/ui';
import { Pagination } from '@/components/pagination';
import { AuditLogTable } from '@/components/audit-log-table';

export const metadata = { title: 'Audit log' };

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const search = searchParams.search ?? '';

  const qs = new URLSearchParams();
  qs.set('page', String(page));
  qs.set('pageSize', '25');
  if (search) qs.set('search', search);

  const result = await loadPageData<AuditLogsResponse>(
    `/admin/audit?${qs.toString()}`,
    '/audit',
  );

  const params: Record<string, string> = {};
  if (search) params.search = search;

  return (
    <main className="p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
          <p className="mt-1 text-sm text-slate-600">
            Every admin action, newest first. Entries are written by the backend and cannot be
            edited or deleted from the dashboard.
          </p>
        </div>
        {result.ok && (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            {result.data.total.toLocaleString('en-GB')} entries
          </span>
        )}
      </div>

      <form method="GET" action="/audit" className="mt-5 flex flex-wrap gap-2">
        <input
          name="search"
          defaultValue={search}
          placeholder="Search action, admin, target id…"
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
            href="/audit"
            className="flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 hover:bg-slate-50"
          >
            Clear
          </Link>
        )}
      </form>

      <div className="mt-5">
        <Card
          title="Admin actions"
          description="Click a row for the full metadata, IP and request id."
        >
          {result.ok ? (
            <>
              <AuditLogTable rows={result.data.logs} />
              <div className="mt-3 border-t border-slate-100 pt-3">
                <Pagination
                  basePath="/audit"
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
