import { SectionPlaceholder } from '@/components/section-placeholder';

export default function Page() {
  return (
    <SectionPlaceholder
      phase="Phase B"
      title="Users"
      description="Every merchant and sub-merchant account. The table defaults to merchants and sub-merchants and hides admin accounts unless the role filter asks for them."
      planned={[
        'Columns: name, phone, Google email, role, merchant, credits, package, status, created, last active',
        'Search by phone, name, or Google email',
        'Filters: role, status, package — backed by GET /admin/users',
        'Row click opens the user detail page with subscription, transactions, verifications, and audit history',
        'Actions: adjust credits, suspend / ban / reactivate, reset PIN, revoke device, change role, impersonate',
      ]}
    />
  );
}
