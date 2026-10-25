// ============================================================
// Yene Verify — Duplicate Detector Unit Tests (13E.1)
//
// Prisma accessed through an in-memory mock — no DB in unit tests.
// ============================================================

import type { PrismaService } from '../../prisma/prisma.service';
import { DuplicateDetector } from './duplicate-detector';

type Row = {
  fingerprint: string;
  firstVerificationId: string;
  firstMerchantId: string;
  bankCode: string;
  bankReference: string;
  firstSeenAt: Date;
  totalHits: number;
};

const makePrisma = (rows: Map<string, Row>): PrismaService =>
  ({
    duplicateFingerprint: {
      findUnique: jest.fn(({ where }: { where: { fingerprint: string } }) =>
        Promise.resolve(rows.get(where.fingerprint) ?? null),
      ),
      create: jest.fn(({ data }: { data: Row }) => {
        rows.set(data.fingerprint, { ...data });
        return Promise.resolve(data);
      }),
      update: jest.fn(
        ({
          where,
          data,
        }: {
          where: { fingerprint: string };
          data: { totalHits: { increment: number } };
        }) => {
          const row = rows.get(where.fingerprint);
          if (!row) return Promise.reject(new Error('not found'));
          row.totalHits += data.totalHits.increment;
          return Promise.resolve(row);
        },
      ),
    },
  }) as unknown as PrismaService;

const seed = (verificationId: string) => ({
  firstVerificationId: verificationId,
  firstMerchantId: 'merchant-1',
  bankCode: 'CBE' as const,
  bankReference: 'FT26195DBK5W81465291',
});

describe('DuplicateDetector', () => {
  it('computeFingerprint is deterministic and sensitive to bank + reference', () => {
    const rows = new Map<string, Row>();
    const d = new DuplicateDetector(makePrisma(rows) as PrismaService);

    const a1 = d.computeFingerprint('CBE', 'FT26195DBK5W81465291');
    const a2 = d.computeFingerprint('CBE', 'FT26195DBK5W81465291');
    const otherBank = d.computeFingerprint('TELEBIRR', 'FT26195DBK5W81465291');
    const otherRef = d.computeFingerprint('CBE', 'FT26195DBK5W81465290');

    expect(a1).toBe(a2);
    expect(a1).toHaveLength(64);
    expect(a1).not.toBe(otherBank);
    expect(a1).not.toBe(otherRef);
  });

  it('check() returns null for an unknown fingerprint', async () => {
    const rows = new Map<string, Row>();
    const d = new DuplicateDetector(makePrisma(rows) as PrismaService);

    expect(await d.check(d.computeFingerprint('CBE', 'FTNEW'))).toBeNull();
  });

  it('check() returns the row data for an existing fingerprint', async () => {
    const rows = new Map<string, Row>();
    const d = new DuplicateDetector(makePrisma(rows) as PrismaService);
    const fingerprint = d.computeFingerprint('CBE', 'FT26195DBK5W81465291');
    await d.record(fingerprint, seed('first-verif'));

    const found = await d.check(fingerprint);

    expect(found).toMatchObject({
      firstVerificationId: 'first-verif',
      firstMerchantId: 'merchant-1',
      totalHits: 1,
    });
    expect(found?.firstSeenAt).toBeInstanceOf(Date);
  });

  it('record() creates a row with the correct fields', async () => {
    const rows = new Map<string, Row>();
    const prisma = makePrisma(rows);
    const d = new DuplicateDetector(prisma as PrismaService);

    await d.record(d.computeFingerprint('ZEMEN', '108IBET252931385'), seed('verif-new'));

    expect(prisma.duplicateFingerprint.create).toHaveBeenCalledTimes(1);
    const stored = [...rows.values()][0];
    expect(stored.bankCode).toBe('CBE');
    expect(stored.bankReference).toBe('FT26195DBK5W81465291');
    expect(stored.totalHits).toBe(1);
  });

  it('incrementHits() bumps total_hits by exactly 1', async () => {
    const rows = new Map<string, Row>();
    const d = new DuplicateDetector(makePrisma(rows) as PrismaService);
    const fingerprint = d.computeFingerprint('CBE', 'FT26195DBK5W81465291');
    await d.record(fingerprint, seed('first-verif'));

    await d.incrementHits(fingerprint);
    await d.incrementHits(fingerprint);

    expect([...rows.values()][0].totalHits).toBe(3);
  });
});
