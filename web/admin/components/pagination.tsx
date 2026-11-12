import Link from 'next/link';

/**
 * Server-rendered pagination. Everything lives in the URL so filters, search
 * and the page number survive a refresh or a shared link.
 */
export function Pagination({
  basePath,
  params,
  page,
  pageSize,
  total,
  totalPages,
}: {
  basePath: string;
  params: Record<string, string>;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}) {
  const hrefFor = (nextPage: number) => {
    const search = new URLSearchParams(params);
    search.set('page', String(nextPage));
    return `${basePath}?${search.toString()}`;
  };

  const firstItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, total);

  const pageNumbers: number[] = [];
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  for (let i = start; i <= Math.min(totalPages, start + 4); i += 1) pageNumbers.push(i);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
      <p className="text-xs">
        Showing <span className="font-medium text-slate-900">{firstItem}</span>–
        <span className="font-medium text-slate-900">{lastItem}</span> of{' '}
        <span className="font-medium text-slate-900">{total.toLocaleString('en-GB')}</span>
      </p>

      {totalPages > 1 && (
        <nav className="flex items-center gap-1" aria-label="Pagination">
          {page > 1 ? (
            <Link
              href={hrefFor(page - 1)}
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs hover:bg-slate-50"
            >
              Previous
            </Link>
          ) : (
            <span className="rounded-lg border border-slate-100 px-2.5 py-1 text-xs text-slate-300">
              Previous
            </span>
          )}

          {pageNumbers.map((number) => (
            <Link
              key={number}
              href={hrefFor(number)}
              aria-current={number === page ? 'page' : undefined}
              className={`rounded-lg px-2.5 py-1 text-xs ${
                number === page
                  ? 'bg-brand text-white'
                  : 'border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {number}
            </Link>
          ))}

          {page < totalPages ? (
            <Link
              href={hrefFor(page + 1)}
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs hover:bg-slate-50"
            >
              Next
            </Link>
          ) : (
            <span className="rounded-lg border border-slate-100 px-2.5 py-1 text-xs text-slate-300">
              Next
            </span>
          )}
        </nav>
      )}
    </div>
  );
}
