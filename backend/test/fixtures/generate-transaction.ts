// ============================================================
// Yene Verify — Test fixture: verified transaction
//
// Satisfies the full FK chain by hand (no queue, no credit
// consumption): receipt → verification (terminal status) →
// transaction projection. Analytics/exports suites use this to
// seed days of history in one call.
//
// Defaults mimic a CBE mobile-money payout: VERIFIED, 5,500.00
// ETB, paid now — every field overridable per row.
// ============================================================

import type { PrismaService } from '../../src/prisma/prisma.service';
import type { BankCode, TransactionStatus } from '@prisma/client';
import { newId } from '../../src/common/utils/id.util';
import { createHash, randomBytes } from 'crypto';

export interface TransactionFixtureInput {
  merchantId: string;
  /** User role recorded on the rows (merchant owner or sub-merchant). */
  verifiedByUserId: string;
  subMerchantId?: string;
  status?: TransactionStatus;
  bankCode?: BankCode;
  bankReference?: string;
  amountMinor?: bigint;
  paidAt?: Date;
  productLabel?: string;
  senderName?: string;
  receiverName?: string;
}

export interface TransactionFixture {
  receiptId: string;
  verificationId: string;
  transactionId: string;
  bankReference: string;
  paidAt: Date;
  amountMinor: bigint;
}

export async function createTransactionFixture(
  prisma: PrismaService,
  input: TransactionFixtureInput,
): Promise<TransactionFixture> {
  const receiptId = newId();
  const verificationId = newId();
  const transactionId = newId();

  const status = input.status ?? 'VERIFIED';
  const bankCode = input.bankCode ?? 'CBE';
  const bankReference = input.bankReference ?? `E2E${randomBytes(6).toString('hex').toUpperCase()}`;
  const amountMinor = input.amountMinor ?? 550_000n;
  const paidAt = input.paidAt ?? new Date();

  await prisma.receipt.create({
    data: {
      id: receiptId,
      merchantId: input.merchantId,
      uploadedByUserId: input.verifiedByUserId,
      storageKey: `e2e/${input.merchantId.slice(0, 8)}/${receiptId}.jpg`,
      mimeType: 'image/jpeg',
      sizeBytes: 1024,
      sha256: createHash('sha256').update(randomBytes(16)).digest('hex'),
      inputMethod: 'UPLOAD',
    },
  });

  await prisma.verification.create({
    data: {
      id: verificationId,
      merchantId: input.merchantId,
      verifiedByUserId: input.verifiedByUserId,
      receiptId,
      source: 'TRANSACTION',
      bankCode,
      bankReference,
      referenceNormalized: bankReference.toUpperCase(),
      amountMinor,
      senderName: input.senderName ?? null,
      receiverName: input.receiverName ?? null,
      paidAt,
      status,
      attemptCount: 1,
      completedAt: new Date(),
    },
  });

  await prisma.transaction.create({
    data: {
      id: transactionId,
      merchantId: input.merchantId,
      verificationId,
      subMerchantId: input.subMerchantId ?? null,
      verifiedByUserId: input.verifiedByUserId,
      bankCode,
      bankReference,
      amountMinor,
      senderName: input.senderName ?? null,
      receiverName: input.receiverName ?? null,
      paidAt,
      status,
      productLabel: input.productLabel ?? null,
    },
  });

  return {
    receiptId,
    verificationId,
    transactionId,
    bankReference,
    paidAt,
    amountMinor,
  };
}

/** Seed many rows for one merchant in a single loop. */
export async function createManyTransactions(
  prisma: PrismaService,
  input: TransactionFixtureInput,
  spec: Array<Partial<TransactionFixtureInput>>,
): Promise<TransactionFixture[]> {
  const out: TransactionFixture[] = [];
  for (const overrides of spec) {
    out.push(await createTransactionFixture(prisma, { ...input, ...overrides }));
  }
  return out;
}
