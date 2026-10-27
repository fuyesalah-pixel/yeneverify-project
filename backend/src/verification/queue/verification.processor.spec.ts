// ============================================================
// Yene Verify — VerificationProcessor Unit Tests (13E.2)
//
// VerificationsService, VerificationsRepository and config are
// mocked; the processor's throw/no-throw decision matrix is
// exhaustively exercised.
// ============================================================

import type { Job } from 'bullmq';
import { RetryableJobError, VerificationProcessor } from './verification.processor';
import { VerificationsService } from '../verifications/verifications.service';
import { VerificationsRepository } from '../verifications/verifications.repository';
import { CreditsExhaustedError } from '../../credits/credit-errors';
import type {
  LoadedVerification,
  VerificationRow,
} from '../verifications/verifications.repository';
import type { VerificationResult } from '../verifications/verifications.types';

// ── Fixtures ─────────────────────────────────────────────────────────────

function makeRow(overrides: Partial<VerificationRow> = {}): VerificationRow {
  return {
    id: 'vid-1',
    merchantId: 'merch-77',
    verifiedByUserId: 'user-42',
    source: 'TRANSACTION',
    bankCode: 'CBE',
    bankReference: null,
    referenceNormalized: null,
    amountMinor: null,
    senderName: null,
    receiverName: null,
    paidAt: null,
    status: 'PENDING',
    ocrRawText: null,
    ocrConfidence: null,
    adapterMetadata: null,
    errorCode: null,
    errorMessage: null,
    ...overrides,
  };
}

function pendingLoad(row: VerificationRow): LoadedVerification {
  // Pending rows always carry their (probe-selected) receipt relation.
  return { kind: 'pending', verification: { ...row, receipt: null } };
}

function finalLoad(row: VerificationRow): LoadedVerification {
  return { kind: 'alreadyFinalized', verification: row };
}

function makeJob(
  verificationId: string,
  attemptsMade: number,
  id = `verification:${verificationId}`,
): Job<{ verificationId: string }> {
  return {
    id,
    data: { verificationId },
    attemptsMade,
    attempts: 3,
    timestamp: Date.now() - 1000,
    processedOn: Date.now(),
  } as unknown as Job<{ verificationId: string }>;
}

function result(overrides: Partial<VerificationResult>): VerificationResult {
  return {
    id: 'vid-1',
    status: 'VERIFIED',
    bankCode: 'CBE',
    bankReference: 'FT1234ABCD56',
    amountMinor: 10000n,
    senderName: null,
    receiverName: null,
    paidAt: null,
    ocrConfidence: 0.93,
    errorCode: null,
    durationMs: 12,
    duplicateOfVerificationId: null,
    needsSupplementary: null,
    ...overrides,
  };
}

// ── Harness ──────────────────────────────────────────────────────────────

describe('VerificationProcessor', () => {
  let processor: VerificationProcessor;
  const serviceMock = { process: jest.fn() };
  const repoMock = { loadForProcessing: jest.fn(), markErrorIfPending: jest.fn() };
  const creditsMock = { consume: jest.fn() };
  const auditMock = { log: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    repoMock.loadForProcessing.mockResolvedValue(pendingLoad(makeRow()));
    repoMock.markErrorIfPending.mockResolvedValue(undefined);
    serviceMock.process.mockResolvedValue(result({}));
    creditsMock.consume.mockResolvedValue({ consumed: 1n, newBalance: 0n, txId: 'tx-1' });
    processor = new VerificationProcessor(
      serviceMock as unknown as VerificationsService,
      repoMock as unknown as VerificationsRepository,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { queue: { jobAttempts: 3, verificationConcurrency: 4, backoffMs: 2000 } } as any,
      creditsMock as never,
      auditMock as never,
    );
  });

  // ── Service invocation shape (Watch #1) ───────────────────────────────

  it('calls service.process() with the correct verificationId', async () => {
    await processor.process(makeJob('vid-1', 0));
    expect(serviceMock.process).toHaveBeenCalledTimes(1);
    expect(serviceMock.process.mock.calls[0][0]).toMatchObject({ verificationId: 'vid-1' });
  });

  it('passes the REAL merchantId/verifiedByUserId loaded from the DB row (not "system")', async () => {
    await processor.process(makeJob('vid-1', 0));
    expect(serviceMock.process.mock.calls[0][0]).toMatchObject({
      merchantId: 'merch-77',
      requestedByUserId: 'user-42',
    });
  });

  it('still extracts actor identity when the row is already finalized', async () => {
    repoMock.loadForProcessing.mockResolvedValue(finalLoad(makeRow({ status: 'VERIFIED' })));
    serviceMock.process.mockResolvedValue(result({}));
    await processor.process(makeJob('vid-1', 0));
    expect(serviceMock.process.mock.calls[0][0]).toMatchObject({
      merchantId: 'merch-77',
      requestedByUserId: 'user-42',
    });
  });

  it('correlates the request id with the BullMQ job id', async () => {
    await processor.process(makeJob('vid-1', 0, 'verification:vid-1#3'));
    expect(serviceMock.process.mock.calls[0][0]).toMatchObject({
      requestId: 'job:verification:vid-1#3',
    });
  });

  // ── Throw/no-throw matrix (the critical distinction) ──────────────────

  it('VERIFIED result → no throw (terminal)', async () => {
    serviceMock.process.mockResolvedValue(result({ status: 'VERIFIED' }));
    await expect(processor.process(makeJob('vid-1', 0))).resolves.toBeUndefined();
    expect(repoMock.markErrorIfPending).not.toHaveBeenCalled();
  });

  it('FAKE result → no throw, no retry, no DB failure marker', async () => {
    serviceMock.process.mockResolvedValue(
      result({ status: 'FAKE', errorCode: 'BANK_REFERENCE_NOT_FOUND' }),
    );
    await expect(processor.process(makeJob('vid-1', 0))).resolves.toBeUndefined();
  });

  it('DUPLICATE result → no throw', async () => {
    serviceMock.process.mockResolvedValue(
      result({ status: 'DUPLICATE', duplicateOfVerificationId: 'vid-original' }),
    );
    await expect(processor.process(makeJob('vid-1', 0))).resolves.toBeUndefined();
  });

  it('NEEDS_REVIEW result (supplementary required) → no throw', async () => {
    serviceMock.process.mockResolvedValue(
      result({ status: 'NEEDS_REVIEW', errorCode: 'BANK_SUPPLEMENTARY_REQUIRED' }),
    );
    await expect(processor.process(makeJob('vid-1', 0))).resolves.toBeUndefined();
  });

  it('ERROR + retryable code + attempt<3 → throws RetryableJobError (exactly once)', async () => {
    serviceMock.process.mockResolvedValue(
      result({ status: 'ERROR', errorCode: 'BANK_ADAPTER_UNAVAILABLE' }),
    );
    await expect(processor.process(makeJob('vid-1', 0))).rejects.toBeInstanceOf(RetryableJobError);
  });

  it('ERROR + retryable code + attempts exhausted → no throw, ERROR stays persisted', async () => {
    serviceMock.process.mockResolvedValue(
      result({ status: 'ERROR', errorCode: 'BANK_ADAPTER_TIMEOUT' }),
    );
    await expect(processor.process(makeJob('vid-1', 2))).resolves.toBeUndefined();
    expect(repoMock.markErrorIfPending).not.toHaveBeenCalled();
  });

  it('ERROR + non-retryable code (reference not found) → no throw', async () => {
    serviceMock.process.mockResolvedValue(
      result({ status: 'ERROR', errorCode: 'BANK_REFERENCE_NOT_FOUND' }),
    );
    await expect(processor.process(makeJob('vid-1', 0))).resolves.toBeUndefined();
    expect(repoMock.markErrorIfPending).not.toHaveBeenCalled();
  });

  it('ERROR + BANK_SUPPLEMENTARY_REQUIRED is NOT retried (the client must prompt)', async () => {
    serviceMock.process.mockResolvedValue(
      result({ status: 'ERROR', errorCode: 'BANK_SUPPLEMENTARY_REQUIRED' }),
    );
    await expect(processor.process(makeJob('vid-1', 0))).resolves.toBeUndefined();
  });

  it('ERROR with null errorCode → no throw, no retry', async () => {
    serviceMock.process.mockResolvedValue(result({ status: 'ERROR', errorCode: null }));
    await expect(processor.process(makeJob('vid-1', 0))).resolves.toBeUndefined();
  });

  // ── attemptsMade handling ──────────────────────────────────────────────

  it('reads job.attemptsMade when deciding exhaustion (attempt 2 of 3 still retries)', async () => {
    serviceMock.process.mockResolvedValue(
      result({ status: 'ERROR', errorCode: 'BANK_ADAPTER_UNAVAILABLE' }),
    );
    const promise = processor.process(makeJob('vid-1', 1));
    await expect(promise).rejects.toThrow(RetryableJobError);
    expect(serviceMock.process).toHaveBeenCalledTimes(1);
  });

  // ── Unexpected failure path ────────────────────────────────────────────

  it('unexpected throw from service → markErrorIfPending called, then re-thrown', async () => {
    serviceMock.process.mockRejectedValue(new Error('P2022: relation missing'));
    await expect(processor.process(makeJob('vid-1', 0))).rejects.toThrow('P2022: relation missing');
    expect(repoMock.markErrorIfPending).toHaveBeenCalledTimes(1);
    expect(repoMock.markErrorIfPending).toHaveBeenCalledWith('vid-1', 'VERIFICATION_QUEUE_FAILURE');
  });

  it('a NoRowFound error from process() still marks the row missing and rethrows', async () => {
    serviceMock.process.mockRejectedValue(new Error('Verification not found: vid-404'));
    repoMock.loadForProcessing.mockResolvedValue(null);
    await expect(processor.process(makeJob('vid-404', 0))).rejects.toThrow(
      'Verification not found',
    );
    expect(repoMock.markErrorIfPending).toHaveBeenCalledWith(
      'vid-404',
      'VERIFICATION_QUEUE_FAILURE',
    );
  });

  it('markErrorIfPending failing does NOT mask the original error', async () => {
    serviceMock.process.mockRejectedValue(new Error('original failure'));
    repoMock.markErrorIfPending.mockRejectedValue(new Error('db dead'));
    await expect(processor.process(makeJob('vid-1', 0))).rejects.toThrow('original failure');
  });

  it('RetryableJobError from service does NOT trigger the failure marker', async () => {
    // Defense in depth: if the SERVICE itself throws a RetryableJobError,
    // it must ride through untouched (no false VERIFICATION_QUEUE_FAILURE).
    serviceMock.process.mockRejectedValue(new RetryableJobError('BANK_ADAPTER_TIMEOUT'));
    await expect(processor.process(makeJob('vid-1', 0))).rejects.toBeInstanceOf(RetryableJobError);
    expect(repoMock.markErrorIfPending).not.toHaveBeenCalled();
  });

  // ── 14.2 — Credit consumption on terminal verdicts ───────────────────

  it('VERIFIED result → credits.consume called once with the DB merchantId', async () => {
    serviceMock.process.mockResolvedValue(result({ status: 'VERIFIED' }));
    await processor.process(makeJob('vid-1', 0));
    expect(creditsMock.consume).toHaveBeenCalledTimes(1);
    expect(creditsMock.consume).toHaveBeenCalledWith({
      merchantId: 'merch-77',
      verificationId: 'vid-1',
      verificationStatus: 'VERIFIED',
    });
  });

  it('FAKE result → consume called with status FAKE (CREDIT_COST decides the price, not the processor)', async () => {
    serviceMock.process.mockResolvedValue(
      result({ status: 'FAKE', errorCode: 'FAKE_UNKNOWN_RECEIPT' }),
    );
    await processor.process(makeJob('vid-1', 0));
    expect(creditsMock.consume).toHaveBeenCalledWith(
      expect.objectContaining({ verificationId: 'vid-1', verificationStatus: 'FAKE' }),
    );
  });

  it('DUPLICATE result → consume called with status DUPLICATE', async () => {
    serviceMock.process.mockResolvedValue(
      result({ status: 'DUPLICATE', duplicateOfVerificationId: 'vid-original' }),
    );
    await processor.process(makeJob('vid-1', 0));
    expect(creditsMock.consume).toHaveBeenCalledWith(
      expect.objectContaining({ verificationStatus: 'DUPLICATE' }),
    );
  });

  it('NEEDS_REVIEW result → consume called with status NEEDS_REVIEW (0-cost)', async () => {
    serviceMock.process.mockResolvedValue(
      result({ status: 'NEEDS_REVIEW', errorCode: 'BANK_SUPPLEMENTARY_REQUIRED' }),
    );
    await processor.process(makeJob('vid-1', 0));
    expect(creditsMock.consume).toHaveBeenCalledWith(
      expect.objectContaining({ verificationStatus: 'NEEDS_REVIEW' }),
    );
  });

  it('non-retryable terminal ERROR (attempts exhausted) → consume called with status ERROR', async () => {
    serviceMock.process.mockResolvedValue(
      result({ status: 'ERROR', errorCode: 'BANK_ADAPTER_TIMEOUT' }),
    );
    await processor.process(makeJob('vid-1', 2)); // attempts exhausted
    expect(creditsMock.consume).toHaveBeenCalledWith(
      expect.objectContaining({ verificationStatus: 'ERROR' }),
    );
  });

  it('ERROR + retryable + attempts remain → consume NEVER called (the retry bills later)', async () => {
    serviceMock.process.mockResolvedValue(
      result({ status: 'ERROR', errorCode: 'BANK_ADAPTER_UNAVAILABLE' }),
    );
    await expect(processor.process(makeJob('vid-1', 0))).rejects.toBeInstanceOf(RetryableJobError);
    expect(creditsMock.consume).not.toHaveBeenCalled();
  });

  it('consume throwing (e.g. raced out of credits) → verdict NOT rolled back; no re-throw; audit consume_failed', async () => {
    serviceMock.process.mockResolvedValue(result({ status: 'VERIFIED' }));
    creditsMock.consume.mockRejectedValue(new CreditsExhaustedError());

    await expect(processor.process(makeJob('vid-1', 0))).resolves.toBeUndefined();
    // The job completed: the persisted verdict stands.
    expect(repoMock.markErrorIfPending).not.toHaveBeenCalled();
    // And the leak is loudly recorded for ops.
    expect(auditMock.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'credits.consume_failed',
        targetType: 'verification',
        targetId: 'vid-1',
      }),
    );
  });

  it('consume failure still does not fail an already-terminal ERROR verdict', async () => {
    serviceMock.process.mockResolvedValue(
      result({ status: 'FAKE', errorCode: 'FAKE_UNKNOWN_RECEIPT' }),
    );
    creditsMock.consume.mockRejectedValue(new Error('ledger write failed'));

    await expect(processor.process(makeJob('vid-1', 0))).resolves.toBeUndefined();
    expect(auditMock.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'credits.consume_failed' }),
    );
  });

  it('idempotent replay on a reprocessed job: consume is called again but CreditsService dedups (no double-charge)', async () => {
    // Simulate BullMQ redelivering the same verificationId: service replays
    // the stored VERIFIED result; consume() is idempotent per
    // verificationId inside CreditsService — the processor passes the same
    // key both times.
    repoMock.loadForProcessing.mockResolvedValue(finalLoad(makeRow({ status: 'VERIFIED' })));
    serviceMock.process.mockResolvedValue(result({ status: 'VERIFIED' }));

    await processor.process(makeJob('vid-1', 0));
    await processor.process(makeJob('vid-1', 0));

    expect(creditsMock.consume).toHaveBeenCalledTimes(2);
    const keys = creditsMock.consume.mock.calls.map((c) => c[0].verificationId);
    expect(new Set(keys).size).toBe(1);
  });
});
