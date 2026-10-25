// ============================================================
// Yene Verify — Transaction Projector Unit Tests (13E.1)
// ============================================================

import { Prisma } from '@prisma/client';
import type { ProjectionClient } from './transaction-projector';
import { TransactionProjector } from './transaction-projector';
import type { VerdictOutcome } from './verifications.types';

const verifiedOutcome = (): VerdictOutcome => ({
  status: 'VERIFIED',
  bankCode: 'CBE',
  bankReference: 'FT26195DBK5W81465291',
  referenceNormalized: 'FT26195DBK5W81465291',
  amountMinor: 12000n,
  senderName: 'Yonas Alemu',
  receiverName: 'Selam Coffee',
  paidAt: new Date('2026-07-14T11:08:00.000Z'),
  metadata: { source: 'cbe-html' },
});

type MakeClientOpts = {
  subMerchantId?: string | null;
  /** Simulate another worker having projected the row first. */
  racy?: boolean;
};

const makeClient = (opts: MakeClientOpts = {}) => {
  const txs: unknown[] = [];
  const client: ProjectionClient = {
    verification: {
      findUnique: jest.fn(() =>
        Promise.resolve({
          id: 'verif-1',
          merchantId: 'merchant-1',
          verifiedByUserId: 'user-1',
          source: 'TRANSACTION',
          status: 'VERIFIED',
        }),
      ),
    } as unknown as ProjectionClient['verification'],
    transaction: {
      create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        if (opts.racy) {
          throw new Prisma.PrismaClientKnownRequestError('unique', {
            code: 'P2002',
            clientVersion: '5',
          });
        }
        txs.push(data);
        return Promise.resolve(data as never);
      }),
    } as unknown as ProjectionClient['transaction'],
    subMerchant: {
      findFirst: jest.fn(() =>
        Promise.resolve(opts.subMerchantId ? { id: opts.subMerchantId } : null),
      ),
    } as unknown as ProjectionClient['subMerchant'],
  };
  return { client, txs };
};

describe('TransactionProjector', () => {
  it('creates a Transaction row with all fields copied', async () => {
    const projector = new TransactionProjector();
    const { client, txs } = makeClient({ subMerchantId: 'sub-1' });

    await projector.project(client, 'verif-1', verifiedOutcome());

    expect(txs).toHaveLength(1);
    const row = txs[0] as Record<string, unknown>;
    expect(row).toMatchObject({
      merchantId: 'merchant-1',
      verificationId: 'verif-1',
      subMerchantId: 'sub-1',
      verifiedByUserId: 'user-1',
      bankCode: 'CBE',
      bankReference: 'FT26195DBK5W81465291',
      amountMinor: 12000n,
      senderName: 'Yonas Alemu',
      receiverName: 'Selam Coffee',
      status: 'VERIFIED',
      productLabel: null,
      notes: null,
    });
    expect(row['id']).toBeDefined();
  });

  it('looks up sub_merchant_id from the verification actor when one exists', async () => {
    const projector = new TransactionProjector();
    const { client, txs } = makeClient({ subMerchantId: 'sub-1' });

    await projector.project(client, 'verif-1', verifiedOutcome());

    expect(client.subMerchant.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', merchantId: 'merchant-1', deletedAt: null },
      }),
    );
    expect((txs[0] as Record<string, unknown>)['subMerchantId']).toBe('sub-1');
  });

  it('attaches no sub-merchant when the actor is a merchant owner', async () => {
    const projector = new TransactionProjector();
    const { client, txs } = makeClient({ subMerchantId: null });

    await projector.project(client, 'verif-1', verifiedOutcome());

    expect((txs[0] as Record<string, unknown>)['subMerchantId']).toBeNull();
  });

  it('is a no-op on a unique-violation race (P2002) instead of throwing', async () => {
    const projector = new TransactionProjector();
    const { client, txs } = makeClient({ racy: true });

    await expect(projector.project(client, 'verif-1', verifiedOutcome())).resolves.toBeUndefined();
    expect(txs).toHaveLength(0);
    expect(client.transaction.create).toHaveBeenCalledTimes(1);
  });

  it('re-throws non-P2002 errors (real failures must roll back the tx)', async () => {
    const projector = new TransactionProjector();
    const { client } = makeClient();
    (client.transaction.create as jest.Mock).mockRejectedValue(new Error('disk full'));

    await expect(projector.project(client, 'verif-1', verifiedOutcome())).rejects.toThrow(
      'disk full',
    );
  });

  it('does nothing for a non-VERIFIED outcome (defensive guard)', async () => {
    const projector = new TransactionProjector();
    const { client, txs } = makeClient({ subMerchantId: null });

    await expect(
      projector.project(client, 'verif-1', { ...verifiedOutcome(), status: 'FAKE' }),
    ).resolves.toBeUndefined();
    expect(client.verification.findUnique).not.toHaveBeenCalled();
    expect(txs).toHaveLength(0);
  });

  it('skips projection when the verification row is missing (same-tx inconsistency)', async () => {
    const projector = new TransactionProjector();
    const { client, txs } = makeClient({ subMerchantId: null });
    (client.verification.findUnique as jest.Mock).mockResolvedValue(null);

    await projector.project(client, 'verif-1', verifiedOutcome());

    expect(txs).toHaveLength(0);
    expect(client.transaction.create).not.toHaveBeenCalled();
  });
});
