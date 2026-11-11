import { SectionPlaceholder } from '@/components/section-placeholder';

export default function Page() {
  return (
    <SectionPlaceholder
      phase="Phase D"
      title="Admins"
      description="Read-only view of the allowlisted admin accounts. Membership is controlled only by the ADMIN_EMAILS environment variable."
      planned={[
        'The allowlisted emails from ADMIN_EMAILS',
        'Last login timestamp and device for each admin',
        'Audit history per admin',
        'No add or remove controls — changing access requires an environment change and a backend restart',
      ]}
    />
  );
}
