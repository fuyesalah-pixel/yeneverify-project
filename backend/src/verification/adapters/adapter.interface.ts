// ============================================================
// Yene Verify — Bank Adapter Contract
//
// Every bank verification engine (CBE, Telebirr, Awash, ...) is a
// BankAdapter. The framework lives in adapter.base.ts (timeout,
// retry, logging, metrics) and adapters/adapter.registry.ts
// (selection). Real adapters arrive in tasks 13D.1–13D.7.
//
// This file is deliberately dependency-free: adapters must be
// importable in isolation, without DB/Redis/HTTP, so they can be
// unit-tested instantly.
// ============================================================

import type { BankCode } from '@prisma/client';

/**
 * Adapter registry keys: the seven real banks from the Prisma enum
 * plus the test-only stub code. TEST_BANK is intentionally absent
 * from the Prisma enum — it exists only for 13E pipeline tests.
 */
export type AdapterBankCode = BankCode | 'TEST_BANK';

/** One verification attempt's inputs. */
export interface VerifyInput {
  /** Reference as extracted from OCR, trimmed. */
  reference: string;
  /** Uppercased, separator-stripped form (see normalizeReference). */
  referenceNormalized: string;
  /** Bank-specific extras, e.g. { accountSuffix: '1234' }. */
  supplementary?: Record<string, string>;
  /** Full OCR text — only read, never logged. */
  rawOcrText: string;
  merchantId: string;
  /** Correlation id for structured logs. */
  requestId: string;
}

export interface VerifyResultSuccess {
  status: 'VERIFIED';
  bankReference: string;
  /** Integer santim (1 ETB = 100). */
  amountMinor: bigint;
  currency: 'ETB';
  senderName: string;
  receiverName: string;
  paidAt: Date;
  metadata: Record<string, unknown>;
}

export interface VerifyResultFailure {
  status: 'FAKE' | 'ERROR';
  /** BANK_ADAPTER_* or FAKE_* code. */
  errorCode: string;
  errorMessage: string;
  /**
   * Whether the failure is transient. FAKE results must always be
   * definitive — AdapterBase never retries them regardless of flag.
   */
  retryable: boolean;
  metadata?: Record<string, unknown>;
}

export type VerifyResult = VerifyResultSuccess | VerifyResultFailure;

export interface VerifySelectedMatch {
  adapter: BankAdapter;
  confidence: number;
}

export interface BankAdapter {
  readonly bankCode: AdapterBankCode;
  readonly displayName: string;

  /** Does this OCR text belong to this bank? Fast, no I/O. */
  detect(rawOcrText: string): boolean;

  /**
   * Optional confidence signal when multiple adapters detect the same
   * text. 0..1; defaults to 0.5 when not implemented.
   */
  detectConfidence?(rawOcrText: string): number;

  /** Extract the transaction reference (null when not found). */
  extractReference(rawOcrText: string): string | null;

  /** Extract bank-specific extras (account suffix, phone, ...). */
  extractSupplementary?(rawOcrText: string): Record<string, string>;

  /** Call the bank (or its surface) and verify. */
  verify(input: VerifyInput): Promise<VerifyResult>;

  /** Health probe. Fast — HEAD/GET a cheap endpoint or local signal. */
  health(): Promise<boolean>;
}
