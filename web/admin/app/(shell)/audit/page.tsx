import { SectionPlaceholder } from '@/components/section-placeholder';

export default function Page() {
  return (
    <SectionPlaceholder
      phase="Phase D"
      title="Audit log"
      description="Every admin action, newest first. Rows are written by the backend and cannot be edited or deleted from the dashboard."
      planned={[
        'Columns: timestamp, admin, action, target, details, IP',
        'Search by action, admin email, or target id',
        'Filter by date range and action family',
        'CSV export of the current filter',
        'Backed by GET /admin/audit',
      ]}
    />
  );
}
