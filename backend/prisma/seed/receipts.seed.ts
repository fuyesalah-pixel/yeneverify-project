import { PrismaClient } from '@prisma/client';
import { IDS } from './ids';
import { log, daysAgo } from './helpers';

// ── receipts.seed.ts — dev/staging only ──────────────────────────────────
// Creates receipt metadata rows. Actual images are NOT uploaded here.
// Storage keys point to placeholder paths in R2/Minio.
// When SEED_UPLOAD_FIXTURES=true, a separate uploadFixturesToR2() helper
// (not yet implemented) pushes the fixture images.

interface ReceiptDef {
  id: string;
  merchantId: string;
  uploadedByUserId: string;
  storageKey: string;
  sha256: string;
  inputMethod: 'PHOTO' | 'UPLOAD';
  daysBack: number;
}

export async function seedReceipts(prisma: PrismaClient): Promise<void> {
  const defs: ReceiptDef[] = [
    // Verified transactions — merchant 1 (Selam Coffee)
    { id: IDS.receipt1,  merchantId: IDS.merchant1, uploadedByUserId: IDS.subMerchant1User, storageKey: `seed/receipts/${IDS.receipt1}.jpg`,  sha256: sha('r01'), inputMethod: 'PHOTO',  daysBack: 29 },
    { id: IDS.receipt2,  merchantId: IDS.merchant1, uploadedByUserId: IDS.subMerchant1User, storageKey: `seed/receipts/${IDS.receipt2}.jpg`,  sha256: sha('r02'), inputMethod: 'UPLOAD', daysBack: 27 },
    { id: IDS.receipt3,  merchantId: IDS.merchant1, uploadedByUserId: IDS.subMerchant2User, storageKey: `seed/receipts/${IDS.receipt3}.jpg`,  sha256: sha('r03'), inputMethod: 'PHOTO',  daysBack: 25 },
    { id: IDS.receipt4,  merchantId: IDS.merchant1, uploadedByUserId: IDS.subMerchant2User, storageKey: `seed/receipts/${IDS.receipt4}.jpg`,  sha256: sha('r04'), inputMethod: 'UPLOAD', daysBack: 23 },
    { id: IDS.receipt5,  merchantId: IDS.merchant1, uploadedByUserId: IDS.merchant1User,    storageKey: `seed/receipts/${IDS.receipt5}.jpg`,  sha256: sha('r05'), inputMethod: 'PHOTO',  daysBack: 21 },
    { id: IDS.receipt6,  merchantId: IDS.merchant1, uploadedByUserId: IDS.subMerchant1User, storageKey: `seed/receipts/${IDS.receipt6}.jpg`,  sha256: sha('r06'), inputMethod: 'PHOTO',  daysBack: 19 },
    { id: IDS.receipt7,  merchantId: IDS.merchant1, uploadedByUserId: IDS.subMerchant1User, storageKey: `seed/receipts/${IDS.receipt7}.jpg`,  sha256: sha('r07'), inputMethod: 'UPLOAD', daysBack: 17 },
    { id: IDS.receipt8,  merchantId: IDS.merchant1, uploadedByUserId: IDS.subMerchant2User, storageKey: `seed/receipts/${IDS.receipt8}.jpg`,  sha256: sha('r08'), inputMethod: 'PHOTO',  daysBack: 15 },
    { id: IDS.receipt9,  merchantId: IDS.merchant1, uploadedByUserId: IDS.merchant1User,    storageKey: `seed/receipts/${IDS.receipt9}.jpg`,  sha256: sha('r09'), inputMethod: 'PHOTO',  daysBack: 12 },
    { id: IDS.receipt10, merchantId: IDS.merchant1, uploadedByUserId: IDS.subMerchant1User, storageKey: `seed/receipts/${IDS.receipt10}.jpg`, sha256: sha('r10'), inputMethod: 'UPLOAD', daysBack: 10 },
    // Fake receipts
    { id: IDS.receipt11, merchantId: IDS.merchant2, uploadedByUserId: IDS.merchant2User,    storageKey: `seed/receipts/${IDS.receipt11}.jpg`, sha256: sha('r11'), inputMethod: 'PHOTO',  daysBack: 8  },
    { id: IDS.receipt12, merchantId: IDS.merchant2, uploadedByUserId: IDS.subMerchant3User, storageKey: `seed/receipts/${IDS.receipt12}.jpg`, sha256: sha('r12'), inputMethod: 'UPLOAD', daysBack: 6  },
    // Duplicate receipt (same sha256 as receipt1 to simulate reuse)
    { id: IDS.receipt13, merchantId: IDS.merchant2, uploadedByUserId: IDS.merchant2User,    storageKey: `seed/receipts/${IDS.receipt13}.jpg`, sha256: sha('r01'), inputMethod: 'UPLOAD', daysBack: 5  },
    // NEEDS_REVIEW + ERROR
    { id: IDS.receipt14, merchantId: IDS.merchant1, uploadedByUserId: IDS.merchant1User,    storageKey: `seed/receipts/${IDS.receipt14}.jpg`, sha256: sha('r14'), inputMethod: 'PHOTO',  daysBack: 3  },
    { id: IDS.receipt15, merchantId: IDS.merchant2, uploadedByUserId: IDS.subMerchant3User, storageKey: `seed/receipts/${IDS.receipt15}.jpg`, sha256: sha('r15'), inputMethod: 'PHOTO',  daysBack: 2  },
  ];

  let count = 0;
  for (const r of defs) {
    const expiresAt = new Date(daysAgo(r.daysBack).getTime() + 90 * 24 * 60 * 60 * 1000);
    await prisma.receipt.upsert({
      where:  { id: r.id },
      create: {
        id:               r.id,
        merchantId:       r.merchantId,
        uploadedByUserId: r.uploadedByUserId,
        storageKey:       r.storageKey,
        mimeType:         'image/jpeg',
        sizeBytes:        102400,
        sha256:           r.sha256,
        inputMethod:      r.inputMethod,
        expiresAt,
        createdAt:        daysAgo(r.daysBack),
      },
      update: { storageKey: r.storageKey },
    });
    count++;
  }

  log('receipts', count);
}

/** Deterministic sha256-like string for seed purposes. */
function sha(key: string): string {
  return Buffer.from(`seed-sha256-${key}`).toString('hex').padEnd(64, '0').slice(0, 64);
}
