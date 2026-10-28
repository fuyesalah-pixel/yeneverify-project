// ============================================================
// Yene Verify — VerificationsService Unit Tests (13E.1)
//
// Full process() runs against injected mocks. The registry is REAL
// (AdapterRegistry) with a programmatically-registered stub — same
// pattern as the adapter suites — so detection routing is
// integration-tested, not faked.
// ============================================================

import { Logger } from '@nestjs/common';
import { AdapterRegistry } from '../adapters/adapter.registry';
import type { BankAdapter, VerifyInput, VerifyResult } from '../adapters/adapter.interface';
import { VerificationsService } from './verifications.service';
import type { VerificationRow, VerificationWithReceipt } from './verifications.repository';
import type { ProcessInput, VerificationResult } from './verifications.types';
import {
  ForbiddenError,
  VerificationNotRetryableError,
  VerificationNotReviewableError,
} from '../../common/errors/domain-errors';
import {
  CreditsExhaustedError,
  CreditsSubscriptionExpiredError,
} from '../../credits/credit-errors';

// ── Fakes ─────────────────────────────────────────────────────────────────

const row = (overrides: Partial<VerificationRow> = {}): VerificationRow => ({
  id: 'verif-1',
  merchantId: 'merchant-1',
  verifiedByUserId: 'user-1',
  source: 'TRANSACTION',
  bankCode: null,
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
});

const pendingRow = (overrides: Partial<VerificationWithReceipt> = {}): VerificationWithReceipt =>
  ({
    ...row(),
    ocrConfidence: null as never,
    receipt: {
      id: 'receipt-1',
      storageKey: 'receipts/k1',
      mimeType: 'image/jpeg',
      deletedAt: null,
    },
    ...overrides,
  }) as VerificationWithReceipt;

const OCR_TEXT = 'CBE transfer FT26195DBK5W81465291 1200.00 Selam Coffee';

/** VERIFIED VerifyResult used by both the process() and HTTP-surface suites. */
const verifiedAdapterResult = (): VerifyResult => ({
  status: 'VERIFIED',
  bankReference: 'FT26195DBK5W81465291',
  amountMinor: 12000n,
  currency: 'ETB',
  senderName: 'Yonas Alemu',
  receiverName: 'Selam Coffee',
  paidAt: new Date('2026-07-14T11:08:00.000Z'),
  metadata: { source: 'stub' },
});

/** Real DB bank code — the sanitization drops TEST_BANK by design (see below). */
const makeStubAdapter = (verifyResult: VerifyResult | Error, detectText = 'CBE'): BankAdapter => ({
  bankCode: 'CBE' as never,
  displayName: 'Test Bank (stub)',
  detect: jest.fn((t: string) => t.includes(detectText)),
  detectConfidence: () => 0.9,
  extractReference: jest.fn(() => 'FT26195DBK5W81465291'),
  verify: jest.fn((_input: VerifyInput) =>
    verifyResult instanceof Error ? Promise.reject(verifyResult) : Promise.resolve(verifyResult),
  ),
  health: async () => true,
});

type Deps = {
  repo: Record<string, jest.Mock>;
  prisma: Record<string, unknown> & { $transaction: jest.Mock };
  storage: { getObject: jest.Mock };
  ocr: { recognize: jest.Mock };
  registry: AdapterRegistry;
  duplicates: {
    computeFingerprint: jest.Mock;
    check: jest.Mock;
    record: jest.Mock;
    incrementHits: jest.Mock;
  };
  projector: { project: jest.Mock };
  audit: { log: jest.Mock };
  queue: { enqueue: jest.Mock; retry: jest.Mock };
  receiptsRepo: { findByIdForMerchant: jest.Mock };
  credits: { checkSubmissionAllowed: jest.Mock };
  notifications: { notifyLowBalance: jest.Mock; notifyExhausted: jest.Mock };
};

const makeDeps = (stubAdapter: BankAdapter): Deps => ({
  repo: {
    loadForProcessing: jest.fn(async () => ({ kind: 'pending', verification: pendingRow() })),
    persistOcr: jest.fn(),
    updateWithOutcome: jest.fn(),
    getSource: jest.fn(async () => 'TRANSACTION'),
    toExistingResult: jest.fn(
      (r: VerificationRow) => ({ id: r.id, status: r.status }) as unknown as VerificationResult,
    ),
  },
  prisma: {
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<void>) =>
      fn({ the_tx_client: true }),
    ),
  },
  storage: { getObject: jest.fn(async () => Buffer.from('img')) },
  ocr: {
    recognize: jest.fn(async () => ({
      text: OCR_TEXT,
      confidence: 0.98,
      provider: 'mock',
      durationMs: 5,
    })),
  },
  registry: new AdapterRegistry(stubAdapter),
  duplicates: {
    computeFingerprint: jest.fn(() => 'fingerprint-hash'),
    check: jest.fn(async () => null),
    record: jest.fn(),
    incrementHits: jest.fn(),
  },
  projector: { project: jest.fn() },
  audit: { log: jest.fn() },
  queue: { enqueue: jest.fn(async () => undefined), retry: jest.fn(async () => undefined) },
  receiptsRepo: { findByIdForMerchant: jest.fn(async () => receiptRow()) },
  credits: {
    checkSubmissionAllowed: jest.fn(async () => ({
      allowed: true,
      balance: 50n,
      unlimited: false,
      lowBalance: false,
    })),
  },
  notifications: {
    notifyLowBalance: jest.fn(async () => undefined),
    notifyExhausted: jest.fn(async () => undefined),
  },
});

/** Receipt row used by submit() (13E.3). Matching uploadedByUserId by default. */
const receiptRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'receipt-1',
  merchantId: 'merchant-1',
  uploadedByUserId: 'user-1',
  mimeType: 'image/jpeg',
  sizeBytes: 1024,
  createdAt: new Date('2026-10-01T00:00:00.000Z'),
  ...overrides,
});

const makeService = (deps: Deps): VerificationsService =>
  new VerificationsService(
    deps.repo as never,
    deps.prisma as never,
    deps.storage as never,
    deps.ocr as never,
    deps.registry,
    deps.duplicates as never,
    deps.projector as never,
    deps.audit as never,
    deps.queue as never,
    deps.receiptsRepo as never,
    deps.credits as never,
    deps.notifications as never,
  );

const input = (overrides: Partial<ProcessInput> = {}): ProcessInput => ({
  verificationId: 'verif-1',
  merchantId: 'merchant-1',
  requestedByUserId: 'user-1',
  requestId: 'req-1',
  ...overrides,
});

describe('VerificationsService.process', () => {
  let logSpy: jest.SpyInstance;
  beforeEach(() => {
    logSpy = jest.spyOn(Logger.prototype as unknown as { log: jest.Mock }, 'log');
  });
  afterEach(() => logSpy.mockRestore());

  const verifiedAdapterResult = (): VerifyResult => ({
    status: 'VERIFIED',
    bankReference: 'FT26195DBK5W81465291',
    amountMinor: 12000n,
    currency: 'ETB',
    senderName: 'Yonas Alemu',
    receiverName: 'Selam Coffee',
    paidAt: new Date('2026-07-14T11:08:00.000Z'),
    metadata: { source: 'stub' },
  });

  it('happy path: OCR → detect → adapter VERIFIED → persist + project + audit', async () => {
    const adapter = makeStubAdapter(verifiedAdapterResult());
    const deps = makeDeps(adapter);
    const service = makeService(deps);

    const result = await service.process(input());

    expect(result.status).toBe('VERIFIED');
    expect(result.amountMinor).toBe(12000n);
    expect(result.duplicateOfVerificationId).toBeNull();
    expect(result.durationMs).toBeGreaterThanOrEqual(0);

    // OCR ran once on the fresh image, result persisted early.
    expect(deps.storage.getObject).toHaveBeenCalledWith('receipts/k1');
    expect(deps.ocr.recognize).toHaveBeenCalledTimes(1);
    expect(deps.repo.persistOcr).toHaveBeenCalledWith('verif-1', OCR_TEXT, 0.98);

    // Adapter received the normalized reference + OCR text.
    expect(adapter.extractReference).toHaveBeenCalledWith(OCR_TEXT);
    expect(adapter.verify).toHaveBeenCalledWith(
      expect.objectContaining({
        reference: 'FT26195DBK5W81465291',
        referenceNormalized: 'FT26195DBK5W81465291',
        rawOcrText: OCR_TEXT,
        merchantId: 'merchant-1',
        requestId: 'req-1',
      }),
    );

    // Fingerprint recorded on first successful verify.
    expect(deps.duplicates.record).toHaveBeenCalledTimes(1);
    expect(deps.duplicates.check).toHaveBeenCalledWith('fingerprint-hash');
    expect(deps.duplicates.incrementHits).not.toHaveBeenCalled();

    // Outcome + projection share one tx; projection happened (source=TRANSACTION).
    expect(deps.prisma.$transaction).toHaveBeenCalledTimes(1);
    // Same tx client instance handed to the update and the projection?
    const updateTx = deps.repo.updateWithOutcome.mock.calls[0][0];
    expect(deps.repo.updateWithOutcome).toHaveBeenCalledWith(
      updateTx,
      'verif-1',
      expect.objectContaining({ status: 'VERIFIED', bankReference: 'FT26195DBK5W81465291' }),
      expect.any(Number),
    );
    expect(deps.projector.project).toHaveBeenCalledWith(
      updateTx,
      'verif-1',
      expect.objectContaining({ status: 'VERIFIED', amountMinor: 12000n }),
    );
    expect(deps.repo.getSource).toHaveBeenCalledWith(updateTx, 'verif-1');

    // Audit AFTER the tx — entry includes no OCR text.
    expect(deps.audit.log).toHaveBeenCalledTimes(1);
    const auditEntry = deps.audit.log.mock.calls[0][0];
    expect(auditEntry.action).toBe('verification.verified');
    expect(JSON.stringify(auditEntry)).not.toContain('FT26195DBK5W81465291Selam');
  });

  it('BILLING source: verified outcome does NOT project a transaction', async () => {
    const adapter = makeStubAdapter(verifiedAdapterResult());
    const deps = makeDeps(adapter);
    deps.repo.getSource.mockResolvedValue('BILLING');
    const service = makeService(deps);

    await service.process(input());

    expect(deps.projector.project).not.toHaveBeenCalled();
  });

  it('idempotent replay: non-PENDING row returns existing result, zero side effects', async () => {
    const adapter = makeStubAdapter(verifiedAdapterResult());
    const deps = makeDeps(adapter);
    deps.repo.loadForProcessing.mockResolvedValue({
      kind: 'alreadyFinalized',
      verification: row({ status: 'VERIFIED', bankCode: 'CBE' }),
    });
    deps.repo.toExistingResult.mockReturnValue({
      id: 'verif-1',
      status: 'VERIFIED',
      bankCode: 'CBE',
      bankReference: 'FT26195DBK5W81465291',
      amountMinor: 12000n,
      senderName: null,
      receiverName: null,
      paidAt: null,
      ocrConfidence: null,
      errorCode: null,
      durationMs: 0,
    });
    const service = makeService(deps);

    const result = await service.process(input());

    expect(result.status).toBe('VERIFIED');
    expect(result.bankCode).toBe('CBE');
    // No OCR, no adapter, no writes, no projection, no audit.
    expect(deps.storage.getObject).not.toHaveBeenCalled();
    expect(deps.ocr.recognize).not.toHaveBeenCalled();
    expect(adapter.verify).not.toHaveBeenCalled();
    expect(deps.prisma.$transaction).not.toHaveBeenCalled();
    expect(deps.repo.updateWithOutcome).not.toHaveBeenCalled();
    expect(deps.duplicates.record).not.toHaveBeenCalled();
    expect(deps.projector.project).not.toHaveBeenCalled();
    expect(deps.audit.log).not.toHaveBeenCalled();
    expect(deps.repo.toExistingResult).toHaveBeenCalledTimes(1);
  });

  it('OCR cached in the row (retry): recognize() never called again', async () => {
    const adapter = makeStubAdapter(verifiedAdapterResult());
    const deps = makeDeps(adapter);
    deps.repo.loadForProcessing.mockResolvedValue({
      kind: 'pending',
      verification: pendingRow({ ocrRawText: OCR_TEXT }),
    });
    const service = makeService(deps);

    const result = await service.process(input());

    expect(result.status).toBe('VERIFIED');
    expect(deps.storage.getObject).not.toHaveBeenCalled();
    expect(deps.ocr.recognize).not.toHaveBeenCalled();
    expect(deps.repo.persistOcr).not.toHaveBeenCalled();
    expect(adapter.verify).toHaveBeenCalledWith(expect.objectContaining({ rawOcrText: OCR_TEXT }));
  });

  it('OCR provider throws → ERROR VERIFICATION_OCR_FAILED', async () => {
    const adapter = makeStubAdapter(verifiedAdapterResult());
    const deps = makeDeps(adapter);
    deps.ocr.recognize.mockRejectedValue(new Error('vision quota'));
    const service = makeService(deps);

    const result = await service.process(input());

    expect(result.status).toBe('ERROR');
    expect(result.errorCode).toBe('VERIFICATION_OCR_FAILED');
    expect(adapter.verify).not.toHaveBeenCalled();
    expect(deps.repo.updateWithOutcome).toHaveBeenCalledWith(
      expect.anything(),
      'verif-1',
      expect.objectContaining({ status: 'ERROR' }),
      expect.any(Number),
    );
    // The updated row went through the tx opened for this finalize.
    expect(deps.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(deps.duplicates.check).not.toHaveBeenCalled();
  });

  it('bank not detected → ERROR VERIFICATION_BANK_NOT_DETECTED', async () => {
    const adapter = makeStubAdapter(verifiedAdapterResult(), 'NEVERMATCHES');
    const deps = makeDeps(adapter);
    const service = makeService(deps);

    const result = await service.process(input());

    expect(result.status).toBe('ERROR');
    expect(result.errorCode).toBe('VERIFICATION_BANK_NOT_DETECTED');
    expect(result.bankCode).toBeNull();
    expect(adapter.verify).not.toHaveBeenCalled();
    expect(deps.audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'verification.error' }),
    );
  });

  it('reference not extracted → ERROR BANK_REFERENCE_NOT_FOUND', async () => {
    const adapter = makeStubAdapter(verifiedAdapterResult());
    (adapter.extractReference as jest.Mock).mockReturnValue(null);
    const deps = makeDeps(adapter);
    const service = makeService(deps);

    const result = await service.process(input());

    expect(result.status).toBe('ERROR');
    expect(result.errorCode).toBe('BANK_REFERENCE_NOT_FOUND');
    expect(result.bankCode).toBe('CBE');
    expect(adapter.verify).not.toHaveBeenCalled();
    expect(deps.projector.project).not.toHaveBeenCalled();
  });

  it('non-DB registry code (TEST_BANK): verdict stands, bankCode persisted as null, duplicate bookkeeping skipped', async () => {
    const adapter = makeStubAdapter(verifiedAdapterResult());
    Object.defineProperty(adapter, 'bankCode', { value: 'TEST_BANK' });
    const deps = makeDeps(adapter);
    const service = makeService(deps);

    const result = await service.process(input());

    // Verdict stands; only the enum column is dropped.
    expect(result.status).toBe('VERIFIED');
    expect(result.bankCode).toBeNull();
    expect(deps.duplicates.check).not.toHaveBeenCalled();
    expect(deps.duplicates.record).not.toHaveBeenCalled();
    // Projection depends on the source, not the bank code — still PROJECTED.
    expect(deps.projector.project).toHaveBeenCalledWith(
      expect.anything(),
      'verif-1',
      expect.objectContaining({ status: 'VERIFIED', bankCode: null }),
    );
    expect(deps.audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'verification.verified' }),
    );
  });

  it('adapter FAKE → status FAKE, no fingerprint, no projection', async () => {
    const adapter = makeStubAdapter({
      status: 'FAKE',
      errorCode: 'BANK_REFERENCE_NOT_FOUND',
      errorMessage: 'not found',
      retryable: false,
      metadata: { reason: 'not-found' },
    });
    const deps = makeDeps(adapter);
    const service = makeService(deps);

    const result = await service.process(input());

    expect(result.status).toBe('FAKE');
    expect(result.errorCode).toBe('BANK_REFERENCE_NOT_FOUND');
    expect(deps.duplicates.check).not.toHaveBeenCalled();
    expect(deps.duplicates.record).not.toHaveBeenCalled();
    expect(deps.projector.project).not.toHaveBeenCalled();
    expect(deps.audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'verification.fake' }),
    );
  });

  it('adapter ERROR (bank down) → status ERROR, no fingerprint', async () => {
    const adapter = makeStubAdapter({
      status: 'ERROR',
      errorCode: 'BANK_ADAPTER_UNAVAILABLE',
      errorMessage: 'all endpoints down',
      retryable: true,
    });
    const deps = makeDeps(adapter);
    const service = makeService(deps);

    const result = await service.process(input());

    expect(result.status).toBe('ERROR');
    expect(result.errorCode).toBe('BANK_ADAPTER_UNAVAILABLE');
    expect(deps.duplicates.check).not.toHaveBeenCalled();
    expect(deps.duplicates.record).not.toHaveBeenCalled();
    expect(deps.projector.project).not.toHaveBeenCalled();
  });

  it('adapter BANK_SUPPLEMENTARY_REQUIRED → NEEDS_REVIEW with the user prompt', async () => {
    const adapter = makeStubAdapter(
      {
        status: 'ERROR',
        errorCode: 'BANK_SUPPLEMENTARY_REQUIRED',
        errorMessage: 'suffix needed',
        retryable: false,
        metadata: { field: 'accountSuffix' },
      },
      'Abyssinia',
    );
    // The hint map is keyed by real bank codes — present one.
    Object.defineProperty(adapter, 'bankCode', { value: 'ABYSSINIA' });
    const deps = makeDeps(adapter);
    const ocrText = 'Abyssinia FT26201XYZ77 suffix needed';
    deps.ocr.recognize.mockResolvedValue({
      text: ocrText,
      confidence: 0.95,
      provider: 'mock',
      durationMs: 5,
    });
    const service = makeService(deps);

    const result = await service.process(input());

    expect(result.status).toBe('NEEDS_REVIEW');
    expect(result.errorCode).toBe('BANK_SUPPLEMENTARY_REQUIRED');
    expect(result.needsSupplementary).toEqual({
      field: 'accountSuffix',
      hint: 'Please provide the last 5 digits of the account you received payment to.',
    });
    expect(deps.projector.project).not.toHaveBeenCalled();
  });

  it('adapter VERIFIED but duplicate found → DUPLICATE, hits incremented, no projection', async () => {
    const adapter = makeStubAdapter(verifiedAdapterResult());
    const deps = makeDeps(adapter);
    deps.duplicates.check.mockResolvedValue({
      firstVerificationId: 'first-verif',
      firstMerchantId: 'other-merchant',
      firstSeenAt: new Date('2026-07-01T08:00:00.000Z'),
      totalHits: 2,
    });
    const service = makeService(deps);

    const result = await service.process(input());

    expect(result.status).toBe('DUPLICATE');
    expect(result.duplicateOfVerificationId).toBe('first-verif');
    expect(deps.duplicates.check).toHaveBeenCalledWith('fingerprint-hash');
    expect(deps.duplicates.incrementHits).toHaveBeenCalledWith('fingerprint-hash');
    expect(deps.duplicates.record).not.toHaveBeenCalled();
    expect(deps.projector.project).not.toHaveBeenCalled();
    expect(deps.audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'verification.duplicate' }),
    );
  });

  it('adapter throws → caught as ERROR BANK_ADAPTER_ERROR, no crash', async () => {
    const adapter = makeStubAdapter(new Error('socket hang up'));
    const deps = makeDeps(adapter);
    const service = makeService(deps);

    const result = await service.process(input());

    expect(result.status).toBe('ERROR');
    expect(result.errorCode).toBe('BANK_ADAPTER_ERROR');
    expect(deps.duplicates.check).not.toHaveBeenCalled();
    expect(deps.audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'verification.error' }),
    );
  });

  it('receipt row missing on a PENDING verification → VerificationReceiptMissingError', async () => {
    const adapter = makeStubAdapter(verifiedAdapterResult());
    const deps = makeDeps(adapter);
    deps.repo.loadForProcessing.mockResolvedValue({
      kind: 'pending',
      verification: { ...pendingRow(), receipt: null },
    });
    const service = makeService(deps);

    await expect(service.process(input())).rejects.toThrow('receipt');
    expect(deps.ocr.recognize).not.toHaveBeenCalled();
    expect(adapter.verify).not.toHaveBeenCalled();
  });

  it('unknown verification id → VerificationNotFoundError', async () => {
    const adapter = makeStubAdapter(verifiedAdapterResult());
    const deps = makeDeps(adapter);
    deps.repo.loadForProcessing.mockResolvedValue(null);
    const service = makeService(deps);

    await expect(service.process(input())).rejects.toThrow('not found');
    expect(adapter.verify).not.toHaveBeenCalled();
  });

  it('PII rule: OCR text, reference and receiver name never reach request logs', async () => {
    const adapter = makeStubAdapter(verifiedAdapterResult());
    const deps = makeDeps(adapter);
    const service = makeService(deps);

    await service.process(input());

    const logged = (logSpy.mock.calls as unknown[][])
      .map((call) => call.map((arg) => String(arg)).join(' '))
      .join('\n');
    expect(logged).not.toContain('Selam Coffee');
    expect(logged).not.toContain('Yonas Alemu');
    // the *normalized* reference may appear; the raw OCR text must not
    expect(logged).not.toContain('CBE transfer');
  });
});

// ── 13E.3 — HTTP surface (submit / read / list / retry / review) ─────────

describe('VerificationsService 13E.3 HTTP surface', () => {
  let logSpy: jest.SpyInstance;
  beforeEach(() => {
    logSpy = jest.spyOn(Logger.prototype as unknown as { log: jest.Mock }, 'log');
  });
  afterEach(() => logSpy.mockRestore());

  const user = (role: 'MERCHANT' | 'SUB_MERCHANT') => ({
    id: 'user-1',
    role,
    merchantId: 'merchant-1',
  });

  const makeListQuery = () => ({
    page: 1,
    pageSize: 20,
    sortBy: 'createdAt' as const,
    sortOrder: 'desc' as const,
  });

  /** Detail-row shape returned by repo.findDetailById mocks. */
  const detailRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'verif-1',
    merchantId: 'merchant-1',
    source: 'TRANSACTION',
    bankCode: null,
    bankReference: null,
    referenceNormalized: null,
    amountMinor: null,
    senderName: null,
    receiverName: null,
    paidAt: null,
    status: 'ERROR',
    ocrConfidence: null,
    adapterMetadata: null,
    errorCode: null,
    errorMessage: null,
    durationMs: null,
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    completedAt: new Date('2026-10-01T00:00:05.000Z'),
    receipt: {
      id: 'receipt-1',
      mimeType: 'image/jpeg',
      sizeBytes: 1024,
      createdAt: new Date('2026-10-01T00:00:00.000Z'),
    },
    ...overrides,
  });

  const withPrisma = (deps: Deps, extra: Record<string, unknown> = {}): Deps => ({
    ...deps,
    prisma: {
      $transaction: deps.prisma.$transaction,
      duplicateFingerprint: { findUnique: jest.fn(async () => null) },
      ...extra,
    },
  });

  it('submit: creates PENDING row, audits and enqueues', async () => {
    const deps = makeDeps(makeStubAdapter(verifiedAdapterResult()));
    deps.repo.createPending = jest.fn(async () => ({ ...row(), createdAt: new Date() }));
    const service = makeService(deps);

    const res = await service.submit({
      user: user('MERCHANT'),
      merchantId: 'merchant-1',
      dto: { receiptId: 'receipt-1', source: 'TRANSACTION' },
      requestId: 'req-1',
    });

    expect(res.status).toBe('PENDING');
    expect(deps.receiptsRepo.findByIdForMerchant).toHaveBeenCalledWith('receipt-1', 'merchant-1');
    expect(deps.repo.createPending).toHaveBeenCalledWith(
      expect.objectContaining({ merchantId: 'merchant-1', verifiedByUserId: 'user-1' }),
    );
    expect(deps.audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'verification.submitted' }),
    );
    expect(deps.queue.enqueue).toHaveBeenCalledWith('verif-1');
  });

  it('submit: sub-merchant cannot verify another user\u2019s receipt', async () => {
    const deps = makeDeps(makeStubAdapter(verifiedAdapterResult()));
    deps.receiptsRepo.findByIdForMerchant = jest.fn(async () =>
      receiptRow({ uploadedByUserId: 'someone-else' }),
    );
    deps.repo.createPending = jest.fn();
    const service = makeService(deps);

    await expect(
      service.submit({
        user: user('SUB_MERCHANT'),
        merchantId: 'merchant-1',
        dto: { receiptId: 'receipt-1', source: 'TRANSACTION' },
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(deps.repo.createPending).not.toHaveBeenCalled();
    expect(deps.queue.enqueue).not.toHaveBeenCalled();
  });

  it('submit: unknown/foreign receipt \u2192 ReceiptNotFoundError', async () => {
    const deps = makeDeps(makeStubAdapter(verifiedAdapterResult()));
    deps.receiptsRepo.findByIdForMerchant = jest.fn(async () => null);
    deps.repo.createPending = jest.fn();
    const service = makeService(deps);

    await expect(
      service.submit({
        user: user('MERCHANT'),
        merchantId: 'merchant-1',
        dto: { receiptId: 'nope', source: 'TRANSACTION' },
      }),
    ).rejects.toThrow('Receipt not found');
    expect(deps.repo.createPending).not.toHaveBeenCalled();
  });

  it('submit BILLING: accepted as source, enqueue proceeds (billing row is Step 16)', async () => {
    const deps = makeDeps(makeStubAdapter(verifiedAdapterResult()));
    deps.repo.createPending = jest.fn(async () => ({ ...row(), createdAt: new Date() }));
    const service = makeService(deps);

    const res = await service.submit({
      user: user('MERCHANT'),
      merchantId: 'merchant-1',
      dto: {
        receiptId: 'receipt-1',
        source: 'BILLING',
        billingPackageCode: 'PREMIUM',
        billingExpectedAmountMinor: '2500',
      },
    });

    expect(res.status).toBe('PENDING');
    expect(deps.repo.createPending).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'BILLING' }),
    );
    expect(deps.queue.enqueue).toHaveBeenCalled();
  });

  // ── 14.2 — submit gating ──────────────────────────────────────────

  it('submit with 0 credits → CreditsExhaustedError (402), NO verification row created', async () => {
    const deps = makeDeps(makeStubAdapter(verifiedAdapterResult()));
    deps.repo.createPending = jest.fn();
    deps.credits.checkSubmissionAllowed = jest.fn(async () => ({
      allowed: false,
      reason: 'INSUFFICIENT_CREDITS' as const,
      balance: 0n,
      unlimited: false,
      lowBalance: false,
    }));
    const service = makeService(deps);

    await expect(
      service.submit({
        user: user('MERCHANT'),
        merchantId: 'merchant-1',
        dto: { receiptId: 'receipt-1', source: 'TRANSACTION' },
      }),
    ).rejects.toBeInstanceOf(CreditsExhaustedError);
    expect(deps.repo.createPending).not.toHaveBeenCalled();
    expect(deps.queue.enqueue).not.toHaveBeenCalled();
  });

  it('submit with expired subscription → CreditsSubscriptionExpiredError (403)', async () => {
    const deps = makeDeps(makeStubAdapter(verifiedAdapterResult()));
    deps.repo.createPending = jest.fn();
    deps.credits.checkSubmissionAllowed = jest.fn(async () => ({
      allowed: false,
      reason: 'SUBSCRIPTION_EXPIRED' as const,
      balance: 5n,
      unlimited: false,
      lowBalance: false,
    }));
    const service = makeService(deps);

    await expect(
      service.submit({
        user: user('MERCHANT'),
        merchantId: 'merchant-1',
        dto: { receiptId: 'receipt-1', source: 'TRANSACTION' },
      }),
    ).rejects.toBeInstanceOf(CreditsSubscriptionExpiredError);
    expect(deps.repo.createPending).not.toHaveBeenCalled();
  });

  it('submit with 5 credits → 202, lowBalance=true (balance <= 20 warning surface)', async () => {
    const deps = makeDeps(makeStubAdapter(verifiedAdapterResult()));
    deps.repo.createPending = jest.fn(async () => ({ ...row(), createdAt: new Date() }));
    deps.credits.checkSubmissionAllowed = jest.fn(async () => ({
      allowed: true,
      balance: 5n,
      unlimited: false,
      lowBalance: true,
    }));
    const service = makeService(deps);

    const res = await service.submit({
      user: user('MERCHANT'),
      merchantId: 'merchant-1',
      dto: { receiptId: 'receipt-1', source: 'TRANSACTION' },
    });
    expect(res.credits).toEqual({ balance: '5', unlimited: false, lowBalance: true });
  });

  it('submit with 50 credits → 202, lowBalance=false', async () => {
    const deps = makeDeps(makeStubAdapter(verifiedAdapterResult()));
    deps.repo.createPending = jest.fn(async () => ({ ...row(), createdAt: new Date() }));
    const service = makeService(deps); // default mock: balance 50n

    const res = await service.submit({
      user: user('MERCHANT'),
      merchantId: 'merchant-1',
      dto: { receiptId: 'receipt-1', source: 'TRANSACTION' },
    });
    expect(res.credits).toEqual({ balance: '50', unlimited: false, lowBalance: false });
  });

  it('submit on an unlimited plan → 202, unlimited=true, lowBalance=false', async () => {
    const deps = makeDeps(makeStubAdapter(verifiedAdapterResult()));
    deps.repo.createPending = jest.fn(async () => ({ ...row(), createdAt: new Date() }));
    deps.credits.checkSubmissionAllowed = jest.fn(async () => ({
      allowed: true,
      balance: 0n,
      unlimited: true,
      lowBalance: false,
    }));
    const service = makeService(deps);

    const res = await service.submit({
      user: user('MERCHANT'),
      merchantId: 'merchant-1',
      dto: { receiptId: 'receipt-1', source: 'TRANSACTION' },
    });
    expect(res.credits).toEqual({ balance: '0', unlimited: true, lowBalance: false });
  });

  it('submit order: the gate runs BEFORE the receipt row insert', async () => {
    const deps = makeDeps(makeStubAdapter(verifiedAdapterResult()));
    deps.repo.createPending = jest.fn();
    deps.credits.checkSubmissionAllowed.mockResolvedValue({
      allowed: false,
      reason: 'INSUFFICIENT_CREDITS' as const,
      balance: 0n,
      unlimited: false,
      lowBalance: false,
    });
    const service = makeService(deps);

    await expect(
      service.submit({
        user: user('MERCHANT'),
        merchantId: 'merchant-1',
        dto: { receiptId: 'receipt-1', source: 'TRANSACTION' },
      }),
    ).rejects.toBeInstanceOf(CreditsExhaustedError);
    expect(deps.repo.createPending).not.toHaveBeenCalled();
  });

  // ── 14.3 Part C — submit-time low-balance notification ─────────────

  it('submit with lowBalance=true fires notifyLowBalance with the gate balance', async () => {
    const deps = makeDeps(makeStubAdapter(verifiedAdapterResult()));
    deps.repo.createPending = jest.fn(async () => ({ ...row(), createdAt: new Date() }));
    deps.credits.checkSubmissionAllowed.mockResolvedValue({
      allowed: true,
      balance: 12n,
      unlimited: false,
      lowBalance: true,
    });
    const service = makeService(deps);

    await service.submit({
      user: user('MERCHANT'),
      merchantId: 'merchant-1',
      dto: { receiptId: 'receipt-1', source: 'TRANSACTION' },
    });
    expect(deps.notifications.notifyLowBalance).toHaveBeenCalledWith('merchant-1', 12n);
    expect(deps.notifications.notifyExhausted).not.toHaveBeenCalled();
  });

  it('submit with lowBalance=false fires no notification', async () => {
    const deps = makeDeps(makeStubAdapter(verifiedAdapterResult()));
    deps.repo.createPending = jest.fn(async () => ({ ...row(), createdAt: new Date() }));
    const service = makeService(deps); // default gate: 50n, lowBalance=false

    await service.submit({
      user: user('MERCHANT'),
      merchantId: 'merchant-1',
      dto: { receiptId: 'receipt-1', source: 'TRANSACTION' },
    });
    expect(deps.notifications.notifyLowBalance).not.toHaveBeenCalled();
  });

  it('notification failures never fail the submit', async () => {
    const deps = makeDeps(makeStubAdapter(verifiedAdapterResult()));
    deps.repo.createPending = jest.fn(async () => ({ ...row(), createdAt: new Date() }));
    deps.credits.checkSubmissionAllowed.mockResolvedValue({
      allowed: true,
      balance: 3n,
      unlimited: false,
      lowBalance: true,
    });
    deps.notifications.notifyLowBalance.mockRejectedValue(new Error('db down'));
    const service = makeService(deps);

    await expect(
      service.submit({
        user: user('MERCHANT'),
        merchantId: 'merchant-1',
        dto: { receiptId: 'receipt-1', source: 'TRANSACTION' },
      }),
    ).resolves.toMatchObject({ status: 'PENDING' });
  });

  it('findByIdForUser: sub-merchant scoping is passed into the WHERE clause', async () => {
    const deps = makeDeps(makeStubAdapter(verifiedAdapterResult()));
    deps.repo.findDetailById = jest.fn(async () => detailRow());
    const service = makeService(withPrisma(deps));

    await service.findByIdForUser({
      user: user('SUB_MERCHANT'),
      merchantId: 'merchant-1',
      verificationId: 'verif-1',
    });
    expect(deps.repo.findDetailById).toHaveBeenCalledWith('verif-1', 'merchant-1', 'user-1');
  });

  it('findByIdForUser: merchant is tenant-wide (no user scope)', async () => {
    const deps = makeDeps(makeStubAdapter(verifiedAdapterResult()));
    deps.repo.findDetailById = jest.fn(async () => detailRow());
    const service = makeService(withPrisma(deps));

    await service.findByIdForUser({
      user: user('MERCHANT'),
      merchantId: 'merchant-1',
      verificationId: 'verif-1',
    });
    expect(deps.repo.findDetailById).toHaveBeenCalledWith('verif-1', 'merchant-1', null);
  });

  it('findByIdForUser: unknown id \u2192 VerificationNotFoundError', async () => {
    const deps = makeDeps(makeStubAdapter(verifiedAdapterResult()));
    deps.repo.findDetailById = jest.fn(async () => null);
    const service = makeService(withPrisma(deps));

    await expect(
      service.findByIdForUser({
        user: user('MERCHANT'),
        merchantId: 'merchant-1',
        verificationId: 'nope',
      }),
    ).rejects.toThrow('not found');
  });

  it('findByIdForUser: PII-safe DTO \u2014 detailFromRow output has no storageKey/ocrRawText/adapterMetadata', async () => {
    const deps = makeDeps(makeStubAdapter(verifiedAdapterResult()));
    deps.repo.findDetailById = jest.fn(async () => detailRow());
    const service = makeService(withPrisma(deps));

    const dto = await service.findByIdForUser({
      user: user('MERCHANT'),
      merchantId: 'merchant-1',
      verificationId: 'verif-1',
    });
    const json = JSON.stringify(dto);
    expect(json).not.toContain('storageKey');
    expect(json).not.toContain('ocrRawText');
    expect(json).not.toContain('adapterMetadata');
    expect(dto.receipt).toEqual(expect.not.objectContaining({ storageKey: expect.anything() }));
  });

  it('findByIdForUser: DUPLICATE row surfaces duplicateOf from metadata', async () => {
    const deps = makeDeps(makeStubAdapter(verifiedAdapterResult()));
    const prisma = withPrisma(deps);
    (
      prisma.prisma as unknown as { duplicateFingerprint: { findUnique: jest.Mock } }
    ).duplicateFingerprint.findUnique = jest.fn(async () => ({
      firstMerchantId: 'first-merchant',
    }));
    deps.repo.findDetailById = jest.fn(async () =>
      detailRow({
        status: 'DUPLICATE',
        adapterMetadata: { duplicateOfVerificationId: 'verif-original' },
        bankCode: 'CBE',
        referenceNormalized: 'FT26195DBK5W81465291',
      }),
    );
    const service = makeService(prisma);

    const dto = await service.findByIdForUser({
      user: user('MERCHANT'),
      merchantId: 'merchant-1',
      verificationId: 'verif-1',
    });
    expect(dto.duplicateOf).toEqual({
      verificationId: 'verif-original',
      merchantId: 'first-merchant',
    });
  });

  it('list: sub-merchant scope applied in the query, not post-fetch', async () => {
    const deps = makeDeps(makeStubAdapter(verifiedAdapterResult()));
    deps.repo.listSummaries = jest.fn(async () => ({ rows: [], total: 0 }));
    const service = makeService(withPrisma(deps));

    await service.list({
      user: user('SUB_MERCHANT'),
      merchantId: 'merchant-1',
      query: makeListQuery(),
    });
    expect(deps.repo.listSummaries).toHaveBeenCalledWith(
      expect.objectContaining({ verifiedByUserId: 'user-1' }),
    );
  });

  it('list: merchant + subMerchantId filter maps to subMerchantUserId scope', async () => {
    const deps = makeDeps(makeStubAdapter(verifiedAdapterResult()));
    deps.repo.listSummaries = jest.fn(async () => ({ rows: [], total: 0 }));
    const service = makeService(withPrisma(deps));

    await service.list({
      user: user('MERCHANT'),
      merchantId: 'merchant-1',
      query: { ...makeListQuery(), subMerchantId: 'sub-9' },
    });
    expect(deps.repo.listSummaries).toHaveBeenCalledWith(
      expect.objectContaining({ subMerchantUserId: 'sub-9' }),
    );
  });

  it('list: pagination math \u2014 totalPages from total/pageSize', async () => {
    const deps = makeDeps(makeStubAdapter(verifiedAdapterResult()));
    deps.repo.listSummaries = jest.fn(async () => ({
      rows: [detailRow(), detailRow({ id: 'verif-2' })],
      total: 21,
    }));
    const service = makeService(withPrisma(deps));

    const res = await service.list({
      user: user('MERCHANT'),
      merchantId: 'merchant-1',
      query: makeListQuery(),
    });
    expect(res.data).toHaveLength(2);
    expect(res.data[0].amountMinor).toBeNull(); // bigint → string-null, never a number
    expect(res.meta).toEqual({ page: 1, pageSize: 20, total: 21, totalPages: 2 });
  });

  it('list: skip/take derived from page/pageSize', async () => {
    const deps = makeDeps(makeStubAdapter(verifiedAdapterResult()));
    deps.repo.listSummaries = jest.fn(async () => ({ rows: [], total: 0 }));
    const service = makeService(withPrisma(deps));

    await service.list({
      user: user('MERCHANT'),
      merchantId: 'merchant-1',
      query: { ...makeListQuery(), page: 3, pageSize: 10 },
    });
    expect(deps.repo.listSummaries).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 }),
    );
  });

  it('retry: sub-merchant \u2192 ForbiddenError, no enqueue', async () => {
    const deps = makeDeps(makeStubAdapter(verifiedAdapterResult()));
    deps.repo.findDetailById = jest.fn(async () => detailRow());
    deps.repo.resetForRetry = jest.fn();
    const service = makeService(withPrisma(deps));

    await expect(
      service.retry({
        user: user('SUB_MERCHANT'),
        merchantId: 'merchant-1',
        verificationId: 'verif-1',
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(deps.repo.resetForRetry).not.toHaveBeenCalled();
    expect(deps.queue.retry).not.toHaveBeenCalled();
  });

  it('retry: VERIFIED \u2192 VerificationNotRetryableError (Watch #5)', async () => {
    const deps = makeDeps(makeStubAdapter(verifiedAdapterResult()));
    deps.repo.findDetailById = jest.fn(async () => detailRow({ status: 'VERIFIED' }));
    deps.repo.resetForRetry = jest.fn();
    const service = makeService(withPrisma(deps));

    await expect(
      service.retry({
        user: user('MERCHANT'),
        merchantId: 'merchant-1',
        verificationId: 'verif-1',
      }),
    ).rejects.toBeInstanceOf(VerificationNotRetryableError);
    expect(deps.repo.resetForRetry).not.toHaveBeenCalled();
    expect(deps.queue.retry).not.toHaveBeenCalled();
  });

  it('retry: FAKE \u2192 VerificationNotRetryableError (Watch #5)', async () => {
    const deps = makeDeps(makeStubAdapter(verifiedAdapterResult()));
    deps.repo.findDetailById = jest.fn(async () => detailRow({ status: 'FAKE' }));
    deps.repo.resetForRetry = jest.fn();
    const service = makeService(withPrisma(deps));

    await expect(
      service.retry({
        user: user('MERCHANT'),
        merchantId: 'merchant-1',
        verificationId: 'verif-1',
      }),
    ).rejects.toBeInstanceOf(VerificationNotRetryableError);
  });

  it('retry: DUPLICATE \u2192 VerificationNotRetryableError', async () => {
    const deps = makeDeps(makeStubAdapter(verifiedAdapterResult()));
    deps.repo.findDetailById = jest.fn(async () => detailRow({ status: 'DUPLICATE' }));
    deps.repo.resetForRetry = jest.fn();
    const service = makeService(withPrisma(deps));

    await expect(
      service.retry({
        user: user('MERCHANT'),
        merchantId: 'merchant-1',
        verificationId: 'verif-1',
      }),
    ).rejects.toBeInstanceOf(VerificationNotRetryableError);
  });

  it('retry: ERROR \u2192 reset + audit + re-enqueue \u2192 202 shape', async () => {
    const deps = makeDeps(makeStubAdapter(verifiedAdapterResult()));
    deps.repo.findDetailById = jest.fn(async () =>
      detailRow({ status: 'ERROR', errorCode: 'BANK_ADAPTER_UNAVAILABLE' }),
    );
    deps.repo.resetForRetry = jest.fn();
    const service = makeService(withPrisma(deps));

    const res = await service.retry({
      user: user('MERCHANT'),
      merchantId: 'merchant-1',
      verificationId: 'verif-1',
    });
    expect(res.status).toBe('PENDING');
    expect(deps.repo.resetForRetry).toHaveBeenCalledWith('verif-1', 'merchant-1');
    expect(deps.audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'verification.retry_requested' }),
    );
    expect(deps.queue.retry).toHaveBeenCalledWith('verif-1');
  });

  it('retry: NEEDS_REVIEW is also retryable', async () => {
    const deps = makeDeps(makeStubAdapter(verifiedAdapterResult()));
    deps.repo.findDetailById = jest.fn(async () => detailRow({ status: 'NEEDS_REVIEW' }));
    deps.repo.resetForRetry = jest.fn();
    const service = makeService(withPrisma(deps));

    const res = await service.retry({
      user: user('MERCHANT'),
      merchantId: 'merchant-1',
      verificationId: 'verif-1',
    });
    expect(res.status).toBe('PENDING');
  });

  it('retry: unknown id \u2192 VerificationNotFoundError', async () => {
    const deps = makeDeps(makeStubAdapter(verifiedAdapterResult()));
    deps.repo.findDetailById = jest.fn(async () => null);
    const service = makeService(withPrisma(deps));

    await expect(
      service.retry({ user: user('MERCHANT'), merchantId: 'merchant-1', verificationId: 'nope' }),
    ).rejects.toThrow('not found');
  });

  it('requestReview: VERIFIED \u2192 VerificationNotReviewableError', async () => {
    const deps = makeDeps(makeStubAdapter(verifiedAdapterResult()));
    deps.repo.findDetailById = jest.fn(async () => detailRow({ status: 'VERIFIED' }));
    deps.repo.updateStatusToNeedsReview = jest.fn();
    const service = makeService(withPrisma(deps));

    await expect(
      service.requestReview({
        user: user('MERCHANT'),
        merchantId: 'merchant-1',
        verificationId: 'verif-1',
        dto: { reason: 'looks wrong' },
      }),
    ).rejects.toBeInstanceOf(VerificationNotReviewableError);
    expect(deps.repo.updateStatusToNeedsReview).not.toHaveBeenCalled();
  });

  it('requestReview: PENDING is not reviewable either', async () => {
    const deps = makeDeps(makeStubAdapter(verifiedAdapterResult()));
    deps.repo.findDetailById = jest.fn(async () => detailRow({ status: 'PENDING' }));
    deps.repo.updateStatusToNeedsReview = jest.fn();
    const service = makeService(withPrisma(deps));

    await expect(
      service.requestReview({
        user: user('MERCHANT'),
        merchantId: 'merchant-1',
        verificationId: 'verif-1',
        dto: { reason: 'waiting forever' },
      }),
    ).rejects.toBeInstanceOf(VerificationNotReviewableError);
  });

  it('requestReview: FAKE \u2192 NEEDS_REVIEW row + review id + audit', async () => {
    const deps = makeDeps(makeStubAdapter(verifiedAdapterResult()));
    deps.repo.findDetailById = jest.fn(async () => detailRow({ status: 'FAKE' }));
    deps.repo.updateStatusToNeedsReview = jest.fn(async () => 'review-1');
    const service = makeService(withPrisma(deps));

    const res = await service.requestReview({
      user: user('MERCHANT'),
      merchantId: 'merchant-1',
      verificationId: 'verif-1',
      dto: { reason: 'genuine receipt was flagged' },
    });
    expect(res.status).toBe('NEEDS_REVIEW');
    expect(res.reviewId).toBe('review-1');
    expect(deps.repo.updateStatusToNeedsReview).toHaveBeenCalledWith(
      'verif-1',
      'merchant-1',
      'user-1',
      'genuine receipt was flagged',
    );
    expect(deps.audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'verification.review_requested' }),
    );
  });

  it('requestReview: concurrent terminal write (updateMany count 0) \u2192 not reviewable', async () => {
    const deps = makeDeps(makeStubAdapter(verifiedAdapterResult()));
    deps.repo.findDetailById = jest.fn(async () => detailRow({ status: 'FAKE' }));
    deps.repo.updateStatusToNeedsReview = jest.fn(async () => null);
    const service = makeService(withPrisma(deps));

    await expect(
      service.requestReview({
        user: user('MERCHANT'),
        merchantId: 'merchant-1',
        verificationId: 'verif-1',
        dto: { reason: 'raced' },
      }),
    ).rejects.toBeInstanceOf(VerificationNotReviewableError);
  });

  it('requestReview: unknown id \u2192 VerificationNotFoundError', async () => {
    const deps = makeDeps(makeStubAdapter(verifiedAdapterResult()));
    deps.repo.findDetailById = jest.fn(async () => null);
    deps.repo.updateStatusToNeedsReview = jest.fn();
    const service = makeService(withPrisma(deps));

    await expect(
      service.requestReview({
        user: user('MERCHANT'),
        merchantId: 'merchant-1',
        verificationId: 'nope',
        dto: { reason: 'check' },
      }),
    ).rejects.toThrow('not found');
  });

  it('audit never carries PII in review metadata (names stay out of the logs)', async () => {
    const deps = makeDeps(makeStubAdapter(verifiedAdapterResult()));
    deps.repo.findDetailById = jest.fn(async () =>
      detailRow({ status: 'FAKE', senderName: 'Secret Sender', receiverName: 'Secret Receiver' }),
    );
    deps.repo.updateStatusToNeedsReview = jest.fn(async () => 'review-1');
    const service = makeService(withPrisma(deps));

    await service.requestReview({
      user: user('MERCHANT'),
      merchantId: 'merchant-1',
      verificationId: 'verif-1',
      dto: { reason: 'some complaint' },
    });

    const auditCalls = deps.audit.log.mock.calls as unknown[][];
    const serialized = JSON.stringify(auditCalls);
    expect(serialized).not.toContain('Secret Sender');
    expect(serialized).not.toContain('Secret Receiver');
  });
});
