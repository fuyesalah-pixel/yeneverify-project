import Link from 'next/link';
import { loadPageData } from '@/lib/backend';
import type { ReviewDetailResponse } from '@/lib/types';
import {
  formatDateTime,
  formatMoneyMinor,
  truncate,
} from '@/lib/format';
import { Badge, Card, DataError, Field, statusTone } from '@/components/ui';
import { FlashToast } from '@/components/flash-toast';
import { ReviewActions } from '@/components/review-actions';

export async function generateMetadata({ params }: { params: { id: string } }) {
  return { title: `Review ${params.id.slice(0, 8)}…` };
}

export default async function ReviewDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: Record<string, string | undefined>;
}) {
  const returnTo = `/review-queue/${params.id}`;
  const result = await loadPageData<ReviewDetailResponse>(
    `/admin/verifications/${params.id}`,
    returnTo,
  );

  if (!result.ok) {
    return (
      <main className="p-6 md:p-8">
        <Link href="/review-queue" className="mb-4 inline-block text-xs font-medium text-brand-dark hover:underline">
          ← Back to review queue
        </Link>
        <DataError message={result.message} />
      </main>
    );
  }

  const { verification, merchant, submittedBy, receipt, review } = result.data;
  const pending = verification.status === 'NEEDS_REVIEW';
  const ocrText = verification.ocrRawText ?? verification.clientOcrText;

  return (
    <main className="p-6 md:p-8">
      <Link href="/review-queue" className="mb-4 inline-block text-xs font-medium text-brand-dark hover:underline">
        ← Back to review queue
      </Link>

      <FlashToast notice={searchParams.notice} error={searchParams.error} />

      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{merchant.businessName}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {receipt ? truncate(receipt.id, 20) : 'No receipt'} · submitted{' '}
            {formatDateTime(verification.createdAt)}
            {submittedBy.fullName ? ` by ${submittedBy.fullName}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={statusTone(verification.status)}>{verification.status.replace('_', ' ')}</Badge>
          {verification.bankCode && <Badge tone="blue">{verification.bankCode}</Badge>}
          <Badge tone="slate">{verification.source}</Badge>
        </div>
      </div>

      {pending && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-amber-900">Waiting for a decision</p>
            <p className="text-xs text-amber-800">
              Check the receipt image against the OCR text and adapter result before resolving.
            </p>
          </div>
          <ReviewActions verificationId={verification.id} returnTo={returnTo} />
        </div>
      )}

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Card
          title="Receipt image"
          description={receipt ? `${receipt.mimeType} · ${Math.round(receipt.sizeBytes / 1024)} KB` : undefined}
        >
          {receipt ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={`/api/admin/verifications/${verification.id}/receipt`}
              alt={`Receipt submitted by ${merchant.businessName}`}
              className="mx-auto max-h-[32rem] w-auto rounded-lg border border-slate-200 bg-slate-50 object-contain"
            />
          ) : (
            <p className="text-sm text-slate-500">No image is stored for this verification.</p>
          )}
        </Card>

        <div className="space-y-5">
          <Card title="Verification">
            <dl className="grid grid-cols-2 gap-3">
              <Field label="Amount" value={formatMoneyMinor(verification.amountMinor)} />
              <Field label="Reference" value={<span className="font-mono text-xs">{verification.bankReference ?? '—'}</span>} />
              <Field label="Paid at" value={formatDateTime(verification.paidAt)} />
              <Field label="Sender" value={verification.senderName ?? '—'} />
              <Field label="Receiver" value={verification.receiverName ?? '—'} />
              <Field label="Attempts" value={verification.attemptCount} />
            </dl>
          </Card>

          <Card title="Why it needs review">
            <div className="space-y-2 text-sm text-slate-700">
              <p className="font-medium text-slate-900">
                {review?.reason ?? verification.errorMessage ?? 'Flagged for manual review.'}
              </p>
              {verification.errorCode && (
                <p className="font-mono text-xs text-slate-500">{verification.errorCode}</p>
              )}
              {review?.requestedBy?.fullName && (
                <p className="text-xs text-slate-500">Flagged by {review.requestedBy.fullName}</p>
              )}
              {review?.resolvedBy && (
                <p className="text-xs text-slate-500">
                  Resolved by {review.resolvedBy.fullName ?? review.resolvedBy.googleEmail} on{' '}
                  {formatDateTime(review.resolvedAt)}
                </p>
              )}
              {review?.resolution && (
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  {review.resolution}
                </p>
              )}
            </div>
          </Card>

          <Card title="Adapter response">
            {verification.adapterMetadata ? (
              <pre className="max-h-64 overflow-auto rounded-lg bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100">
                {JSON.stringify(verification.adapterMetadata, null, 2)}
              </pre>
            ) : (
              <p className="text-sm text-slate-500">The adapter returned no metadata.</p>
            )}
            {verification.qrContent && (
              <p className="mt-2 break-all font-mono text-[11px] text-slate-500">
                QR ({verification.qrType ?? 'unknown'}): {verification.qrContent}
              </p>
            )}
          </Card>
        </div>
      </div>

      <Card
        className="mt-5"
        title="OCR text"
        description={
          verification.ocrConfidence !== null
            ? `Server OCR confidence ${(verification.ocrConfidence * 100).toFixed(0)}%`
            : verification.clientOcrConfidence !== null
              ? `On-device OCR confidence ${(verification.clientOcrConfidence * 100).toFixed(0)}%`
              : undefined
        }
      >
        {ocrText ? (
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-700">
            {ocrText}
          </pre>
        ) : (
          <p className="text-sm text-slate-500">No OCR text was captured.</p>
        )}
        {verification.clientOcrText && verification.ocrRawText && (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-medium text-slate-500">
              On-device OCR text
            </summary>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-[11px] text-slate-600">
              {verification.clientOcrText}
            </pre>
          </details>
        )}
      </Card>
    </main>
  );
}
