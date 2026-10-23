// ============================================================
// Yene Verify — Receipts Service Unit Tests
//
// Storage and persistence are mocked: these cover the guard rails, not
// the plumbing. The critical case is the cross-tenant key check.
// ============================================================

import { Test } from '@nestjs/testing';
import { createHash } from 'crypto';
import type { AuthUser } from '../common/types/auth-user.type';
import { StorageService } from '../storage/storage.service';
import { MAX_RECEIPT_BYTES } from '../storage/drivers/storage-driver.interface';
import { OcrService } from '../ocr/ocr.service';
import { ReceiptsService } from './receipts.service';
import { ReceiptsRepository } from './receipts.repository';
import { AuditService } from '../audit/audit.service';

const MERCHANT_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_MERCHANT_ID = '22222222-2222-4222-8222-222222222222';
const USER_ID = '33333333-3333-4333-8333-333333333333';

const merchant: AuthUser = { id: USER_ID, role: 'MERCHANT', merchantId: MERCHANT_ID };

function user(overrides: Partial<AuthUser>): AuthUser {
  return { ...merchant, ...overrides };
}

describe('ReceiptsService', () => {
  let service: ReceiptsService;
  let storage: {
    presignUpload: jest.Mock;
    presignDownload: jest.Mock;
    head: jest.Mock;
    getObject: jest.Mock;
    activeDriverName: jest.Mock;
  };
  let repo: { create: jest.Mock; findByIdForMerchant: jest.Mock };
  let audit: { log: jest.Mock };

  const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
  const sha256Of = (buf: Buffer) => createHash('sha256').update(buf).digest('hex');

  beforeEach(async () => {
    storage = {
      presignUpload: jest.fn().mockResolvedValue({
        uploadUrl: 'http://localhost:3000/internal/storage-upload/key?token=abc',
        method: 'PUT',
        headers: {},
      }),
      presignDownload: jest.fn().mockResolvedValue({ downloadUrl: 'http://localhost:3000/dl' }),
      head: jest.fn(),
      getObject: jest.fn(),
      activeDriverName: jest.fn().mockReturnValue('local'),
    };
    repo = {
      create: jest.fn(),
      findByIdForMerchant: jest.fn(),
    };
    audit = { log: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ReceiptsService,
        { provide: StorageService, useValue: storage },
        { provide: ReceiptsRepository, useValue: repo },
        { provide: AuditService, useValue: audit },
        // recognize() is stubbed; the OCR provider contract has its own specs.
        { provide: OcrService, useValue: { recognize: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(ReceiptsService);
  });

  // ── presign ─────────────────────────────────────────────────────────────

  describe('presign', () => {
    it('returns a tenant-scoped storage key and upload URL', async () => {
      const res = await service.presign(merchant, {
        fileName: 'receipt.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 2048,
        inputMethod: 'PHOTO',
      });

      expect(res.storageKey).toMatch(new RegExp(`^receipts/${MERCHANT_ID}/.+\\.jpg$`));
      expect(res.method).toBe('PUT');
      expect(res.expiresAt).toEqual(expect.any(String));
      expect(storage.presignUpload).toHaveBeenCalledWith(res.storageKey, 'image/jpeg', 300);
    });

    it('derives the extension from the mime type', async () => {
      const png = await service.presign(merchant, {
        fileName: 'a.png',
        mimeType: 'image/png',
        sizeBytes: 10,
        inputMethod: 'UPLOAD',
      });
      expect(png.storageKey.endsWith('.png')).toBe(true);
    });

    it('rejects a disallowed mime type', async () => {
      await expect(
        service.presign(merchant, {
          fileName: 'a.txt',
          mimeType: 'text/plain' as never,
          sizeBytes: 10,
          inputMethod: 'UPLOAD',
        }),
      ).rejects.toMatchObject({ code: 'RECEIPT_INVALID_TYPE' });
      expect(storage.presignUpload).not.toHaveBeenCalled();
    });

    it('rejects a file larger than the maximum', async () => {
      await expect(
        service.presign(merchant, {
          fileName: 'big.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: MAX_RECEIPT_BYTES + 1,
          inputMethod: 'UPLOAD',
        }),
      ).rejects.toMatchObject({ code: 'RECEIPT_TOO_LARGE' });
    });

    it('rejects a user with no merchant scope', async () => {
      await expect(
        service.presign(
          { id: USER_ID, role: 'MERCHANT' },
          {
            fileName: 'a.jpg',
            mimeType: 'image/jpeg',
            sizeBytes: 10,
            inputMethod: 'UPLOAD',
          },
        ),
      ).rejects.toMatchObject({ code: 'TENANT_ISOLATION_VIOLATION' });
    });

    it('never creates a receipt row', async () => {
      await service.presign(merchant, {
        fileName: 'a.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 10,
        inputMethod: 'UPLOAD',
      });
      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  // ── complete ────────────────────────────────────────────────────────────

  describe('complete', () => {
    const key = `receipts/${MERCHANT_ID}/abc.jpg`;

    it('creates the receipt when the checksum matches', async () => {
      storage.head.mockResolvedValue({
        exists: true,
        sizeBytes: JPEG.length,
        contentType: 'image/jpeg',
      });
      storage.getObject.mockResolvedValue(JPEG);
      repo.create.mockImplementation((input: Record<string, unknown>) => ({
        id: 'receipt-1',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        ...input,
      }));

      const res = await service.complete(merchant, {
        storageKey: key,
        inputMethod: 'PHOTO',
        sha256: sha256Of(JPEG),
        width: 800,
        height: 600,
      });

      expect(res.receiptId).toBe('receipt-1');
      expect(res.sizeBytes).toBe(JPEG.length);
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          merchantId: MERCHANT_ID,
          uploadedByUserId: USER_ID,
          storageKey: key,
          mimeType: 'image/jpeg',
          width: 800,
          height: 600,
          inputMethod: 'PHOTO',
          sha256: sha256Of(JPEG),
        }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'receipt.uploaded', targetType: 'receipt' }),
      );
    });

    it('rejects a key belonging to another tenant', async () => {
      await expect(
        service.complete(merchant, {
          storageKey: `receipts/${OTHER_MERCHANT_ID}/abc.jpg`,
          inputMethod: 'UPLOAD',
          sha256: sha256Of(JPEG),
        }),
      ).rejects.toMatchObject({ code: 'TENANT_ISOLATION_VIOLATION' });

      expect(storage.head).not.toHaveBeenCalled();
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('rejects a mismatched checksum', async () => {
      storage.head.mockResolvedValue({ exists: true, sizeBytes: JPEG.length });
      storage.getObject.mockResolvedValue(JPEG);

      await expect(
        service.complete(merchant, {
          storageKey: key,
          inputMethod: 'UPLOAD',
          sha256: 'a'.repeat(64),
        }),
      ).rejects.toMatchObject({ code: 'RECEIPT_HASH_MISMATCH' });

      expect(repo.create).not.toHaveBeenCalled();
    });

    it('rejects when the object was never uploaded', async () => {
      storage.head.mockResolvedValue(null);

      await expect(
        service.complete(merchant, {
          storageKey: key,
          inputMethod: 'UPLOAD',
          sha256: sha256Of(JPEG),
        }),
      ).rejects.toMatchObject({ code: 'RECEIPT_NOT_UPLOADED' });

      expect(repo.create).not.toHaveBeenCalled();
    });

    it('rejects an object above the size limit', async () => {
      storage.head.mockResolvedValue({
        exists: true,
        sizeBytes: MAX_RECEIPT_BYTES + 1,
        contentType: 'image/jpeg',
      });

      await expect(
        service.complete(merchant, {
          storageKey: key,
          inputMethod: 'UPLOAD',
          sha256: sha256Of(JPEG),
        }),
      ).rejects.toMatchObject({ code: 'RECEIPT_TOO_LARGE' });
    });

    it('rejects a non-image content type', async () => {
      storage.head.mockResolvedValue({
        exists: true,
        sizeBytes: 10,
        contentType: 'text/html',
      });

      await expect(
        service.complete(merchant, {
          storageKey: key,
          inputMethod: 'UPLOAD',
          sha256: sha256Of(JPEG),
        }),
      ).rejects.toMatchObject({ code: 'RECEIPT_INVALID_TYPE' });
    });
  });

  // ── getById ─────────────────────────────────────────────────────────────

  describe('getById', () => {
    const record = {
      id: 'receipt-1',
      merchantId: MERCHANT_ID,
      uploadedByUserId: USER_ID,
      storageKey: `receipts/${MERCHANT_ID}/abc.jpg`,
      mimeType: 'image/jpeg',
      sizeBytes: 10,
      width: null,
      height: null,
      sha256: 'b'.repeat(64),
      inputMethod: 'PHOTO',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      expiresAt: null,
    };

    it('returns metadata with a download URL for the owning merchant', async () => {
      repo.findByIdForMerchant.mockResolvedValue(record);

      const res = await service.getById(merchant, 'receipt-1');

      expect(res.receiptId).toBe('receipt-1');
      expect(res.downloadUrl).toBe('http://localhost:3000/dl');
      expect(repo.findByIdForMerchant).toHaveBeenCalledWith('receipt-1', MERCHANT_ID);
    });

    it('404s when the receipt belongs to another tenant', async () => {
      repo.findByIdForMerchant.mockResolvedValue(null);

      await expect(
        service.getById(user({ merchantId: OTHER_MERCHANT_ID }), 'receipt-1'),
      ).rejects.toMatchObject({ code: 'RECEIPT_NOT_FOUND' });
    });

    it('forbids a sub-merchant reading another uploader receipt', async () => {
      repo.findByIdForMerchant.mockResolvedValue(record);

      await expect(
        service.getById(
          { id: 'other-user', role: 'SUB_MERCHANT', merchantId: MERCHANT_ID },
          'receipt-1',
        ),
      ).rejects.toMatchObject({ httpStatus: 403 });
    });

    it('allows a sub-merchant to read their own receipt', async () => {
      repo.findByIdForMerchant.mockResolvedValue(record);

      const res = await service.getById(
        { id: USER_ID, role: 'SUB_MERCHANT', merchantId: MERCHANT_ID },
        'receipt-1',
      );
      expect(res.receiptId).toBe('receipt-1');
    });
  });
});
