// ============================================================
// Yene Verify — Verifications Service (13E.1)
//
// The heart of the pipeline. process() turns "receipt + adapter"
// into a persisted verification verdict:
//
//   load row → OCR (cached on retry) → detect bank → extract
//   reference → adapter.verify → resolveVerdict → duplicates →
//   persist + project transaction (atomic) → audit → return.
//
// Deliberately NOT in this file (13E.2/13E.3): BullMQ queue, HTTP
// endpoints, FCM push sent.
// ============================================================

import { Injectable, Logger } from '@nestjs/common';
import { BankCode } from '@prisma/client';
import { normalizeReference } from '../regex/reference-patterns';
import type { VerifyInput } from '../adapters/adapter.interface';
import { AdapterRegistry } from '../adapters/adapter.registry';
import { OcrService } from '../../ocr/ocr.service';
import { StorageService } from '../../storage/storage.service';
import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ForbiddenError,
  ReceiptNotFoundError,
  VerificationNotFoundError,
  VerificationNotReviewableError,
  VerificationNotRetryableError,
  VerificationReceiptMissingError,
} from '../../common/errors/domain-errors';
import type { AuthUser } from '../../common/types/auth-user.type';
import { VerificationQueueService } from '../queue/verification-queue.service';
import { ReceiptsRepository } from '../../receipts/receipts.repository';
import { CreditsService } from '../../credits/credits.service';
import { NotificationsService } from '../../notifications/notifications.service';
import {
  CreditsExhaustedError,
  CreditsSubscriptionExpiredError,
} from '../../credits/credit-errors';
import { DuplicateDetector } from './duplicate-detector';
import { TransactionProjector } from './transaction-projector';
import { resolveVerdict } from './verdict-resolver';
import { buildSupplementaryData } from '../../merchants/verification-accounts';
import { VerificationsRepository } from './verifications.repository';
import type {
  DetectionStageResult,
  ProcessInput,
  VerificationResult,
  VerdictOutcome,
} from './verifications.types';
import type {
  CreateVerificationDto,
  RequestReviewDto,
  VerificationDetailDto,
  VerificationListResponseDto,
} from './dto';
import type { VerificationSubmittedResponseDto } from './dto/verification-response.dto';
import { detailFromRow, duplicateReferenceFromMetadata, listFromRows } from './response-mapper';

/**
 * The DB's BankCode enum tracks the seven real banks only; TEST_BANK
 * exists purely as a registry key for pipeline tests (see
 * adapters/adapter.interface.ts) and must never reach an enum column —
 * persist such outcomes with bankCode=null, keeping the raw code in the
 * audit log and adapter metadata.
 */
const DB_BANK_CODES: ReadonlySet<string> = new Set(Object.values(BankCode) as string[]);

function normalizeBankCodeForDb(bankCode: string | null | undefined): string | null {
  return bankCode && DB_BANK_CODES.has(bankCode) ? bankCode : null;
}

@Injectable()
export class VerificationsService {
  private readonly logger = new Logger(VerificationsService.name);
  constructor(
    private readonly repo: VerificationsRepository,
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly ocr: OcrService,
    private readonly registry: AdapterRegistry,
    private readonly duplicates: DuplicateDetector,
    private readonly projector: TransactionProjector,
    private readonly audit: AuditService,
    private readonly queue: VerificationQueueService,
    private readonly receiptsRepo: ReceiptsRepository,
    private readonly credits: CreditsService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Process one verification to its terminal verdict. Idempotent:
   * reprocessing a non-PENDING verification replays the stored
   * result without touching OCR, adapters, or DB writes.
   */
  async process(input: ProcessInput): Promise<VerificationResult> {
    const startedAt = Date.now();
    const loaded = await this.repo.loadForProcessing(input.verificationId);

    if (!loaded) {
      throw new VerificationNotFoundError(input.verificationId);
    }
    if (loaded.kind === 'alreadyFinalized') {
      this.logger.log(
        `Verification ${input.verificationId} already finalized (${loaded.verification.status}) — idempotent replay`,
      );
      return this.repo.toExistingResult(loaded.verification);
    }

    const { verification } = loaded;
    if (!verification.receipt || verification.receipt.deletedAt) {
      throw new VerificationReceiptMissingError(
        verification.id,
        verification.receipt?.id ?? 'none',
      );
    }

    const requestId = input.requestId ?? input.verificationId;

    // ── Stage 1: OCR (cached from a prior partial run when present) ──
    let ocrText = verification.ocrRawText;
    const state: DetectionStageResult = {
      ocrConfidence: verification.ocrConfidence?.toNumber() ?? null,
      bankCode: null,
      referenceNormalized: null,
    };

    if (!ocrText) {
      try {
        const bytes = await this.storage.getObject(verification.receipt.storageKey);
        const ocr = await this.ocr.recognize(bytes, verification.receipt.mimeType);
        ocrText = ocr.text;
        state.ocrConfidence = ocr.confidence;
        if (!ocrText) {
          throw new Error('empty result');
        }
        // Persist early so a later retry never re-runs OCR.
        await this.repo.persistOcr(verification.id, ocrText, ocr.confidence);
      } catch (err) {
        return this.finalize(input, startedAt, {
          status: 'ERROR',
          errorCode: 'VERIFICATION_OCR_FAILED',
          errorMessage: 'Could not extract text from the receipt image.',
          metadata: { stage: 'ocr', reason: err instanceof Error ? err.message : 'unknown' },
        });
      }
    }

    // ── Stage 2: bank detection ──
    const detection = this.registry.detectBest(ocrText);
    if (!detection) {
      return this.finalize(input, startedAt, {
        status: 'ERROR',
        errorCode: 'VERIFICATION_BANK_NOT_DETECTED',
        errorMessage: 'Could not identify the bank from the receipt.',
        metadata: { stage: 'detect', ocrTextLength: ocrText.length },
      });
    }
    const { adapter, confidence } = detection;
    state.bankCode = adapter.bankCode as DetectionStageResult['bankCode'];

    // ── Stage 3: reference extraction ──
    const reference = adapter.extractReference(ocrText);
    if (!reference) {
      return this.finalize(input, startedAt, {
        status: 'ERROR',
        bankCode: adapter.bankCode as never,
        errorCode: 'BANK_REFERENCE_NOT_FOUND',
        errorMessage: 'No transaction reference could be extracted from this receipt.',
        metadata: { stage: 'extract', detectionConfidence: confidence },
      });
    }
    const referenceNormalized = normalizeReference(reference);
    state.referenceNormalized = referenceNormalized;

    // ── Stage 4: adapter call (supplementary = OCR guesses + merchant config) ──
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: input.merchantId },
      select: { verificationAccounts: true },
    });
    const ocrSupplementary = adapter.extractSupplementary?.(ocrText) ?? {};
    const configuredSupplementary = buildSupplementaryData(
      adapter.bankCode,
      merchant?.verificationAccounts,
    );
    const adapterInput: VerifyInput = {
      reference,
      referenceNormalized,
      // Merchant-configured accounts win over OCR-derived guesses.
      supplementary: { ...ocrSupplementary, ...configuredSupplementary },
      rawOcrText: ocrText,
      merchantId: input.merchantId,
      requestId,
    };

    this.logger.log(
      `Verification ${verification.id} → ${adapter.bankCode} ref=${referenceNormalized} (request ${requestId})`,
    );

    let adapterResult;
    try {
      adapterResult = await adapter.verify(adapterInput);
    } catch (err) {
      adapterResult = {
        status: 'ERROR' as const,
        errorCode: 'BANK_ADAPTER_ERROR',
        errorMessage: 'The bank adapter failed unexpectedly.',
        retryable: true,
        metadata: { stage: 'adapter', reason: err instanceof Error ? err.message : 'unknown' },
      };
    }

    // ── Stage 5: duplicate resolution (VERIFIED, real banks only) ──
    // duplicate_fingerprints.bankCode is a NOT NULL DB enum: TEST_BANK
    // outcomes (test stubs) can never be recorded, checked for, or hit-
    // escalated — skipping consistently keeps VERIFIED as their verdict.
    let duplicate = null;
    if (adapterResult.status === 'VERIFIED' && DB_BANK_CODES.has(adapter.bankCode)) {
      const fingerprint = this.duplicates.computeFingerprint(
        adapter.bankCode as never,
        referenceNormalized,
      );
      duplicate = await this.duplicates.check(fingerprint);
      if (duplicate) {
        // Escalate the counter for the admin dashboard before finalizing.
        await this.duplicates.incrementHits(fingerprint);
      } else {
        await this.duplicates.record(fingerprint, {
          firstVerificationId: verification.id,
          firstMerchantId: input.merchantId,
          bankCode: adapter.bankCode as never,
          bankReference: referenceNormalized,
        });
      }
    }

    const outcome = resolveVerdict({
      adapterResult,
      adapterBankCode: adapter.bankCode as never,
      duplicate,
      errorContext: null,
    });
    outcome.referenceNormalized = referenceNormalized;
    // Persisted alongside bankCode so the status endpoint shows it.
    outcome.bankReference ??= referenceNormalized;

    return this.finalize(input, startedAt, outcome, state);
  }

  // ── 13E.3 — HTTP surface (submit / read / retry / review) ─────────

  /**
   * Create a PENDING verification row and enqueue it. BILLING source
   * rows are accepted but the full billing flow (billing_verifications
   * insert, credit grant, approval) is Step 16.
   */
  async submit(input: {
    user: AuthUser;
    merchantId: string;
    dto: CreateVerificationDto;
    requestId?: string;
  }): Promise<VerificationSubmittedResponseDto> {
    const { user, merchantId, dto } = input;

    // Tenant-scoped receipt; a SUB_MERCHANT may only verify their own uploads.
    const receipt = await this.receiptsRepo.findByIdForMerchant(dto.receiptId, merchantId);
    if (!receipt) {
      throw new ReceiptNotFoundError();
    }
    if (user.role === 'SUB_MERCHANT' && receipt.uploadedByUserId !== user.id) {
      throw new ForbiddenError('You can only verify receipts you uploaded.');
    }

    // Gate BEFORE creating the row: a merchant with no credits never
    // enters the queue. The 402/403 typed errors carry balance context.
    const gate = await this.credits.checkSubmissionAllowed(merchantId);
    if (!gate.allowed) {
      if (gate.reason === 'SUBSCRIPTION_EXPIRED') {
        throw new CreditsSubscriptionExpiredError(merchantId);
      }
      throw new CreditsExhaustedError(gate.balance);
    }

    // In-app warning the moment the gate says the balance is running
    // low. Fire-and-forget — notification failures never block a submit.
    if (gate.lowBalance) {
      this.notifications
        .notifyLowBalance(merchantId, gate.balance)
        .catch((err: unknown) =>
          this.logger.warn(
            `verification.low_balance.notify_failed error=${err instanceof Error ? err.message : String(err)}`,
          ),
        );
    }

    // TODO Step 16: create the billing_verifications row on BILLING source.
    const row = await this.repo.createPending({
      merchantId,
      verifiedByUserId: user.id,
      receiptId: dto.receiptId,
      source: dto.source,
    });

    this.audit.log({
      actorType: 'USER',
      actorUserId: user.id,
      action: 'verification.submitted',
      targetType: 'verification',
      targetId: row.id,
      requestId: input.requestId,
      metadata: {
        merchantId,
        receiptId: dto.receiptId,
        source: dto.source,
        billing:
          dto.source === 'BILLING' ? { packageCode: dto.billingPackageCode ?? null } : undefined,
      },
    });

    await this.queue.enqueue(row.id);

    this.logger.log(`Verification ${row.id} submitted by ${user.id} (source=${dto.source})`);

    return {
      verificationId: row.id,
      status: 'PENDING' as const,
      createdAt: new Date().toISOString(),
      credits: {
        balance: gate.balance.toString(),
        unlimited: gate.unlimited,
        lowBalance: gate.lowBalance,
      },
    };
  }

  /** GET /verifications/:id — tenant- and sub-merchant-scoped detail. */
  async findByIdForUser(input: {
    user: AuthUser;
    merchantId: string;
    verificationId: string;
  }): Promise<VerificationDetailDto> {
    const subMerchantUserId = input.user.role === 'SUB_MERCHANT' ? input.user.id : null;

    const row = await this.repo.findDetailById(
      input.verificationId,
      input.merchantId,
      subMerchantUserId,
    );
    if (!row) {
      throw new VerificationNotFoundError(input.verificationId);
    }

    let duplicateOf = null;
    if (row.status === 'DUPLICATE') {
      const { verificationId } = duplicateReferenceFromMetadata(
        (row.adapterMetadata ?? null) as Record<string, unknown> | null,
      );
      if (verificationId) {
        const fingerprintRow = await this.prisma.duplicateFingerprint.findUnique({
          where: {
            fingerprint: this.duplicates.computeFingerprint(
              /** cbe */ row.bankCode as never,
              row.referenceNormalized as string,
            ),
          },
        });
        duplicateOf = {
          verificationId,
          merchantId: fingerprintRow?.firstMerchantId ?? '',
        };
      }
    }

    return detailFromRow(row, duplicateOf);
  }

  /** GET /verifications — tenant-scoped, sub-merchant-scoped list. */
  async list(input: {
    user: AuthUser;
    merchantId: string;
    query: {
      page: number;
      pageSize: number;
      status?: string[];
      source?: 'TRANSACTION' | 'BILLING';
      bankCode?: string[];
      from?: string;
      to?: string;
      subMerchantId?: string;
      search?: string;
      sortBy: 'createdAt' | 'amountMinor';
      sortOrder: 'asc' | 'desc';
    };
  }): Promise<VerificationListResponseDto> {
    const { rows, total } = await this.repo.listSummaries({
      merchantId: input.merchantId,
      // Hard WHERE scope for SUB_MERCHANT callers; MERCHANT is tenant-wide.
      verifiedByUserId: input.user.role === 'SUB_MERCHANT' ? input.user.id : null,
      // MERCHANT drilldown filter; cannot apply with SUB role at once.
      subMerchantUserId:
        input.user.role === 'MERCHANT' ? (input.query.subMerchantId ?? null) : null,
      status: input.query.status ?? null,
      source: input.query.source ?? null,
      bankCode: input.query.bankCode ?? null,
      from: input.query.from ? new Date(input.query.from) : null,
      to: input.query.to ? new Date(input.query.to) : null,
      search: input.query.search ?? null,
      sortBy: input.query.sortBy,
      sortOrder: input.query.sortOrder,
      skip: (input.query.page - 1) * input.query.pageSize,
      take: input.query.pageSize,
    });

    return listFromRows(rows, total, input.query.page, input.query.pageSize);
  }

  /**
   * Retry an ERROR or NEEDS_REVIEW verification. VERIFIED / FAKE /
   * DUPLICATE are definitive — retrying them would hammer the bank
   * with a receipt that is already known (fake) or resolved.
   */
  async retry(input: {
    user: AuthUser;
    merchantId: string;
    verificationId: string;
  }): Promise<{ verificationId: string; status: 'PENDING' }> {
    if (input.user.role === 'SUB_MERCHANT') {
      throw new ForbiddenError('Only the merchant can retry a verification.');
    }

    const row = await this.repo.findDetailById(input.verificationId, input.merchantId, null);
    if (!row) {
      throw new VerificationNotFoundError(input.verificationId);
    }
    if (row.status !== 'ERROR' && row.status !== 'NEEDS_REVIEW') {
      throw new VerificationNotRetryableError(row.status);
    }

    await this.repo.resetForRetry(input.verificationId, input.merchantId);

    this.audit.log({
      actorType: 'USER',
      actorUserId: input.user.id,
      action: 'verification.retry_requested',
      targetType: 'verification',
      targetId: input.verificationId,
      metadata: { merchantId: input.merchantId, previousStatus: row.status },
    });

    await this.queue.retry(input.verificationId);

    return { verificationId: input.verificationId, status: 'PENDING' };
  }

  /**
   * Flag a verification for manual review (MERCHANT only, enforced at
   * the route). VERIFIED / DUPLICATE are terminal — flag them is noise.
   */
  async requestReview(input: {
    user: AuthUser;
    merchantId: string;
    verificationId: string;
    dto: RequestReviewDto;
  }): Promise<{ verificationId: string; reviewId: string; status: 'NEEDS_REVIEW' }> {
    const row = await this.repo.findDetailById(input.verificationId, input.merchantId, null);
    if (!row) {
      throw new VerificationNotFoundError(input.verificationId);
    }
    if (row.status === 'VERIFIED' || row.status === 'DUPLICATE' || row.status === 'PENDING') {
      throw new VerificationNotReviewableError(row.status);
    }

    const reviewId = await this.repo.updateStatusToNeedsReview(
      input.verificationId,
      input.merchantId,
      input.user.id,
      input.dto.reason,
    );
    if (!reviewId) {
      // updateMany raced with a concurrent verdict/terminal write.
      throw new VerificationNotReviewableError(row.status);
    }

    this.audit.log({
      actorType: 'USER',
      actorUserId: input.user.id,
      action: 'verification.review_requested',
      targetType: 'verification',
      targetId: input.verificationId,
      metadata: {
        merchantId: input.merchantId,
        reviewId,
        previousStatus: row.status,
      },
    });

    return {
      verificationId: input.verificationId,
      reviewId,
      status: 'NEEDS_REVIEW',
    };
  }

  // ── Completion ──────────────────────────────────────────────────────────

  /**
   * Single exit path: writes outcome + transaction projection in ONE
   * transaction, then audits AFTER commit (a rollback must not lose
   * the audit trail — and an audit inside the tx would be rolled
   * back with it).
   */
  private async finalize(
    input: ProcessInput,
    startedAt: number,
    outcome: VerdictOutcome,
    stage: DetectionStageResult | null = null,
  ): Promise<VerificationResult> {
    const durationMs = Date.now() - startedAt;
    outcome.errorMessage ??= outcome.status === 'ERROR' ? 'Verification could not complete.' : null;
    // Persisted columns are DB enums: a test-only registry code like
    // TEST_BANK is not one. Keep verdict + reference; drop just the code.
    outcome.bankCode = normalizeBankCodeForDb(outcome.bankCode) as BankCode | null;

    await this.prisma.$transaction(async (tx) => {
      await this.repo.updateWithOutcome(tx, input.verificationId, outcome, durationMs);

      if (outcome.status === 'VERIFIED') {
        // Projection must not open its own transaction (Watch #3):
        // pass the caller's tx through.
        const source = await this.repo.getSource(tx, input.verificationId);
        if (source === 'TRANSACTION') {
          await this.projector.project(tx, input.verificationId, outcome);
        }
      }
    });

    this.audit.log({
      actorType: 'SYSTEM',
      actorUserId: input.requestedByUserId,
      action: `verification.${outcome.status.toLowerCase()}`,
      targetType: 'verification',
      targetId: input.verificationId,
      requestId: input.requestId,
      metadata: {
        merchantId: input.merchantId,
        status: outcome.status,
        bankCode: outcome.bankCode ?? undefined,
        errorCode: outcome.errorCode ?? undefined,
        durationMs,
        // ocr confidence is a number, safe to audit
        ocrConfidence: stage?.ocrConfidence ?? undefined,
      },
    });

    this.logger.log(
      `Verification ${input.verificationId} outcome=${outcome.status} durationMs=${durationMs}`,
    );

    return {
      id: input.verificationId,
      status: outcome.status,
      bankCode: outcome.bankCode ?? null,
      bankReference: outcome.bankReference ?? null,
      amountMinor: outcome.amountMinor ?? null,
      senderName: outcome.senderName ?? null,
      receiverName: outcome.receiverName ?? null,
      paidAt: outcome.paidAt ?? null,
      ocrConfidence: stage?.ocrConfidence ?? null,
      errorCode: outcome.errorCode ?? null,
      durationMs,
      duplicateOfVerificationId: outcome.duplicateOfVerificationId ?? null,
      needsSupplementary: outcome.needsSupplementary ?? null,
    };
  }
}
