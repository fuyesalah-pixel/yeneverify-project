import { loadPageData } from '@/lib/backend';
import type { NotificationAudience, NotificationHistoryResponse } from '@/lib/types';
import { Button } from '@/components/shadcn/button';
import { Card, DataError } from '@/components/ui';
import { Pagination } from '@/components/pagination';
import { FlashToast } from '@/components/flash-toast';
import { NotificationComposer } from '@/components/notification-composer';
import { NotificationHistory } from '@/components/notification-history';

export const metadata = { title: 'Notifications' };

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const page = Math.max(1, Number(searchParams.page ?? 1));

  const [audience, history] = await Promise.all([
    loadPageData<NotificationAudience>('/admin/notifications/audience', '/notifications'),
    loadPageData<NotificationHistoryResponse>(
      `/admin/notifications/history?page=${page}&pageSize=20`,
      '/notifications',
    ),
  ]);

  return (
    <main className="p-6 md:p-8">
      <FlashToast notice={searchParams.notice} error={searchParams.error} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
          <p className="mt-1 text-sm text-slate-600">
            Send an announcement to merchants and watch delivery settle. Automated verdict and
            credit notifications are not listed here.
          </p>
        </div>
        {audience.ok && (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            {audience.data.all.toLocaleString('en-GB')} reachable account(s)
          </span>
        )}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <Card
          title="Compose"
          description="Every send is confirmed before it leaves and audited after."
        >
          {audience.ok ? (
            <NotificationComposer audience={audience.data} returnTo="/notifications" />
          ) : (
            <DataError message={audience.message} />
          )}
        </Card>

        <Card
          title="History"
          description="Click a row for per-recipient delivery stats."
          action={
            <Button asChild variant="outline" size="sm">
              <a href="/notifications">Refresh</a>
            </Button>
          }
        >
          {history.ok ? (
            <>
              <NotificationHistory rows={history.data.notifications} />
              <div className="mt-3 border-t border-slate-100 pt-3">
                <Pagination
                  basePath="/notifications"
                  params={{}}
                  page={history.data.page}
                  pageSize={history.data.pageSize}
                  total={history.data.total}
                  totalPages={history.data.totalPages}
                />
              </div>
            </>
          ) : (
            <DataError message={history.message} />
          )}
        </Card>
      </div>
    </main>
  );
}
