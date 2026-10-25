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
import { normalizeReference } from '../regex/reference-patterns';
import type { VerifyInput } from '../adapters/adapter.interface';
import { AdapterRegistry } from '../adapters/adapter.registry';
import { OcrService } from '../../ocr/ocr.service';
import { StorageService } from '../../storage/storage.service';
import { AuditService } from '../../audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  VerificationNotFoundError,
  VerificationReceiptMissingError,
} from '../../common/errors/domain-errors';
import { DuplicateDetector } from './duplicate-detector';
import { TransactionProjector } from './transaction-projector';
import { resolveVerdict } from './verdict-resolver';
import { VerificationsRepository } from './verifications.repository';
import type {
  DetectionStageResult,
  ProcessInput,
  VerificationResult,
  VerdictOutcome,
} from './verifications.types';

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

    // ── Stage 4: adapter call (supplementary extraction left to the adapter) ──
    const adapterInput: VerifyInput = {
      reference,
      referenceNormalized,
      supplementary: adapter.extractSupplementary?.(ocrText) ?? {},
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

    // ── Stage 5: duplicate resolution (VERIFIED results only) ──
    let duplicate = null;
    if (adapterResult.status === 'VERIFIED') {
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
