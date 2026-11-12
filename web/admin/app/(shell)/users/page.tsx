import Link from 'next/link';
import { loadPageData } from '@/lib/backend';
import type { UserListResponse } from '@/lib/types';
import { formatRelative } from '@/lib/format';
import { Badge, statusTone, EmptyRow, TABLE_HEAD, TABLE_CELL } from '@/components/ui';
import { Pagination } from '@/components/pagination';

const ROLES = ['MERCHANT', 'SUB_MERCHANT', 'ADMIN'] as const;
const STATUSES = ['ACTIVE', 'SUSPENDED', 'BANNED', 'DELETED'] as const;
const PACKAGES = ['FREE', 'PREMIUM', 'BUSINESS', 'BUSINESS_PRO', 'API'] as const;

export const metadata = { title: 'Users' };

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const role = searchParams.role ?? '';
  const status = searchParams.status ?? '';
  const pkg = searchParams.package ?? '';
  const search = searchParams.search ?? '';

  const qs = new URLSearchParams();
  qs.set('page', String(page));
  qs.set('pageSize', '20');
  if (role) qs.set('role', role);
  if (status) qs.set('status', status);
  if (pkg) qs.set('package', pkg);
  if (search) qs.set('search', search);

  const result = await loadPageData<UserListResponse>(`/admin/users?${qs.toString()}`, '/users');

  const params: Record<string, string> = {};
  if (role) params.role = role;
  if (status) params.status = status;
  if (pkg) params.package = pkg;
  if (search) params.search = search;

  return (
    <main className="p-6 md:p-8">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="mt-1 text-sm text-slate-600">
            Every merchant and sub-merchant on the platform.
          </p>
        </div>
        {result.ok && (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            {result.data.total.toLocaleString('en-GB')} total
          </span>
        )}
      </div>

      {/* filters */}
      <form method="GET" action="/users" className="mt-5 flex flex-wrap gap-2">
        <input
          name="search"
          defaultValue={search}
          placeholder="Search name, phone, email…"
          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand sm:w-64"
        />
        <select
          name="role"
          defaultValue={role}
          className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand"
        >
          <option value="">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r.replace('_', ' ')}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={status}
          className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          name="package"
          defaultValue={pkg}
          className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand"
        >
          <option value="">All packages</option>
          {PACKAGES.map((p) => (
            <option key={p} value={p}>
              {p.replace('_', ' ')}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="h-9 rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-brand-dark transition"
        >
          Filter
        </button>
        {(search || role || status || pkg) && (
          <Link
            href="/users"
            className="flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 hover:bg-slate-50"
          >
            Clear
          </Link>
        )}
      </form>

      {/* table */}
      <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        {!result.ok ? (
          <div className="p-6 text-sm text-red-600">{result.message}</div>
        ) : (
          <>
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className={TABLE_HEAD}>Name</th>
                  <th className={TABLE_HEAD}>Google email</th>
                  <th className={TABLE_HEAD}>Phone</th>
                  <th className={TABLE_HEAD}>Role</th>
                  <th className={TABLE_HEAD}>Merchant</th>
                  <th className={TABLE_HEAD}>Credits</th>
                  <th className={TABLE_HEAD}>Package</th>
                  <th className={TABLE_HEAD}>Status</th>
                  <th className={TABLE_HEAD}>Last active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {result.data.users.length === 0 ? (
                  <EmptyRow colSpan={9}>No users found.</EmptyRow>
                ) : (
                  result.data.users.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50/60 transition">
                      <td className={TABLE_CELL}>
                        <Link
                          href={`/users/${user.id}`}
                          className="font-medium text-slate-900 hover:text-brand-dark hover:underline"
                        >
                          {user.fullName || '—'}
                        </Link>
                      </td>
                      <td className={TABLE_CELL}>
                        {user.googleEmail ? (
                          <span className="text-slate-600">{user.googleEmail}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className={TABLE_CELL}>{user.phone}</td>
                      <td className={TABLE_CELL}>
                        <Badge
                          tone={
                            user.role === 'MERCHANT'
                              ? 'green'
                              : user.role === 'ADMIN'
                                ? 'blue'
                                : 'slate'
                          }
                        >
                          {user.role.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className={TABLE_CELL}>
                        {user.merchant ? (
                          <div>
                            <Link
                              href={`/users/${user.id}`}
                              className="text-slate-700 hover:underline"
                            >
                              {user.merchant.businessName}
                            </Link>
                            {user.merchant.relation === 'SUB_MERCHANT' && (
                              <p className="mt-0.5 text-[11px] text-slate-400">
                                Sub-merchant
                                {user.merchant.branchLabel
                                  ? ` · ${user.merchant.branchLabel}`
                                  : ''}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className={TABLE_CELL}>
                        {user.creditsBalance !== null
                          ? Number(user.creditsBalance).toLocaleString('en-GB')
                          : '—'}
                      </td>
                      <td className={TABLE_CELL}>
                        {user.packageCode ? (
                          <Badge tone="blue">{user.packageCode.replace('_', ' ')}</Badge>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className={TABLE_CELL}>
                        <Badge tone={statusTone(user.status)}>{user.status}</Badge>
                      </td>
                      <td className={TABLE_CELL}>
                        <span className="text-slate-500">{formatRelative(user.lastLoginAt)}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <div className="border-t border-slate-100 px-4 py-3">
              <Pagination
                basePath="/users"
                params={params}
                page={result.data.page}
                pageSize={result.data.pageSize}
                total={result.data.total}
                totalPages={result.data.totalPages}
              />
            </div>
          </>
        )}
      </div>
    </main>
  );
}
