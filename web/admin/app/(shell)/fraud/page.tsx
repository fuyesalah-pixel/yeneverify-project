import { SectionPlaceholder } from '@/components/section-placeholder';

export default function Page() {
  return (
    <SectionPlaceholder
      phase="Phase D"
      title="Fraud & duplicates"
      description="Cross-merchant duplicate fingerprints and velocity patterns that need a human decision."
      planned={[
        'Duplicate fingerprints grouped by receipt hash across merchants',
        'Suspicious patterns such as one receipt used by 3+ merchants in 24h',
        'Merchant drill-down with related verifications',
        'Export and audit trail for every follow-up action',
      ]}
    />
  );
}
