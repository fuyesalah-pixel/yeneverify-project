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

const makeStubAdapter = (verifyResult: VerifyResult | Error, detectText = 'CBE'): BankAdapter => ({
  bankCode: 'TEST_BANK' as never,
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
  repo: {
    loadForProcessing: jest.Mock;
    persistOcr: jest.Mock;
    updateWithOutcome: jest.Mock;
    getSource: jest.Mock;
    toExistingResult: jest.Mock;
  };
  prisma: { $transaction: jest.Mock };
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
    expect(result.bankCode).toBe('TEST_BANK');
    expect(adapter.verify).not.toHaveBeenCalled();
    expect(deps.projector.project).not.toHaveBeenCalled();
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
