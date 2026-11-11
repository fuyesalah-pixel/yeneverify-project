import { SectionPlaceholder } from '@/components/section-placeholder';

export default function Page() {
  return (
    <SectionPlaceholder
      phase="Phase A / E"
      title="System health"
      description="Live dependency status for the backend, database, Redis, and tunnel."
      planned={[
        'Backend uptime and version',
        'Database and Redis connection checks (GET /admin/health)',
        'Cloudflare Tunnel reachability',
        'Recent errors from logs / Sentry (last 20)',
      ]}
    />
  );
}
