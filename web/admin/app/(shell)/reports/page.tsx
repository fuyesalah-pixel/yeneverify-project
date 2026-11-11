import { SectionPlaceholder } from '@/components/section-placeholder';

export default function Page() {
  return (
    <SectionPlaceholder
      phase="Phase B"
      title="Reports & credits"
      description="Global credit flow, per-merchant consumption, and manual credit adjustments."
      planned={[
        'Credits issued and consumed today / week / month, plus net balance across merchants',
        'Daily consumption chart for the last 30 days',
        'Per-merchant table: balance, consumed (30d), revenue (30d), last top-up, package',
        'CSV export for per-merchant reports',
        'Add credits by phone or business name, with a confirmation dialog and ADJUSTMENT audit entry',
      ]}
    />
  );
}
