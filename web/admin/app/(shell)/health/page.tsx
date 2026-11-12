import { SystemHealth } from '@/components/system-health';

export const metadata = { title: 'System health' };

export default function HealthPage() {
  return (
    <main className="p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">System health</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Live dependency status from the backend readiness probes, the Cloudflare tunnel, and the
            seven bank adapters.
          </p>
        </div>
      </div>

      <div className="mt-5">
        <SystemHealth />
      </div>
    </main>
  );
}
