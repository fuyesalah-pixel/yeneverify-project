import Link from 'next/link';
import { SectionPlaceholder } from '@/components/section-placeholder';

export default function Page({ params }: { params: { id: string } }) {
  return (
    <SectionPlaceholder
      phase="Phase B"
      title={`User ${params.id}`}
      description="Profile, subscription, recent transactions and verifications, and the audit trail for this account."
      planned={[
        'Full profile: name, phone, Google email, merchant business name',
        'Subscription: plan, credits balance, expiry',
        'Recent transactions and verifications (paginated)',
        'Audit log filtered to this user',
        'Adjust credits, suspend / ban / reactivate, reset PIN, revoke device, change role, impersonate (read-only)',
      ]}
    >
      <Link
        href="/users"
        className="mb-4 inline-block text-xs font-medium text-brand-dark hover:underline"
      >
        ← Back to users
      </Link>
    </SectionPlaceholder>
  );
}
