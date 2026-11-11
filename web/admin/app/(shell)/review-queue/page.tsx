import { SectionPlaceholder } from '@/components/section-placeholder';

export default function Page() {
  return (
    <SectionPlaceholder
      phase="Phase C"
      title="Review queue"
      description="Verifications flagged NEEDS_REVIEW, with the receipt image, OCR text, and adapter result side by side."
      planned={[
        'Queue list with merchant, bank, amount, and submission time',
        'Detail viewer: receipt image, OCR text, adapter verdict',
        'Approve marks VERIFIED, reject marks FAKE — both require confirmation',
        'Admin note attached to the review record',
        'Every decision writes an audit entry with the admin email',
      ]}
    />
  );
}
