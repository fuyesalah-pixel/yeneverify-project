import { loadPageData } from '@/lib/backend';
import type { FeatureFlagsResponse, PaymentInstructions } from '@/lib/types';
import { DataError } from '@/components/ui';
import { FlashToast } from '@/components/flash-toast';
import { PlatformConfig } from '@/components/platform-config';

export const metadata = { title: 'Platform config' };
export const dynamic = 'force-dynamic';

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const [flagsResult, paymentResult] = await Promise.all([
    loadPageData<FeatureFlagsResponse>('/admin/config/flags', '/settings'),
    loadPageData<PaymentInstructions>('/admin/config/payments', '/settings'),
  ]);

  return (
    <main className="p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Platform config</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Feature flags and billing destinations. Every change is confirmed and written to the
            audit log.
          </p>
        </div>
      </div>

      <FlashToast notice={searchParams.notice} error={searchParams.error} />

      <div className="mt-5">
        {!flagsResult.ok || !paymentResult.ok ? (
          <DataError
            message={
              !flagsResult.ok
                ? flagsResult.message
                : !paymentResult.ok
                  ? paymentResult.message
                  : 'Could not load platform config.'
            }
          />
        ) : (
          <PlatformConfig
            flags={flagsResult.data.flags}
            payment={paymentResult.data}
            returnTo="/settings"
          />
        )}
      </div>
    </main>
  );
}
