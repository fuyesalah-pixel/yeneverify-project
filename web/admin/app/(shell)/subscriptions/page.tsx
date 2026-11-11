import { SectionPlaceholder } from '@/components/section-placeholder';

export default function Page() {
  return (
    <SectionPlaceholder
      phase="Phase D"
      title="Subscriptions"
      description="Active subscriptions per plan, monthly recurring revenue, and churn."
      planned={[
        'Active subscription counts by package',
        'MRR computed from active plan prices',
        'Churn rate over the trailing 30 days',
        'Per-merchant subscription table with renewal dates',
      ]}
    />
  );
}
