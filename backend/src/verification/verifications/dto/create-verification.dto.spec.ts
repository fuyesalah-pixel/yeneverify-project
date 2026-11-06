// ============================================================
// Yene Verify — Create Verification DTO: QR fields (v1.8.4)
// ============================================================

import { CreateVerificationDtoSchema } from './create-verification.dto';

const RECEIPT_ID = '11111111-1111-4111-8111-111111111111';

const parse = (extra: Record<string, unknown>) =>
  CreateVerificationDtoSchema.safeParse({ receiptId: RECEIPT_ID, ...extra });

const issuePaths = (result: ReturnType<typeof parse>): string[] =>
  result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'));

describe('CreateVerificationDtoSchema — QR hint fields', () => {
  it('accepts qrContent + qrType together', () => {
    const result = parse({
      qrContent: 'CBE FT26195DBK5W81465291',
      qrType: 'reference',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.qrType).toBe('reference');
    }
  });

  it('accepts a submission without QR fields', () => {
    expect(parse({}).success).toBe(true);
  });

  it('rejects qrContent without qrType', () => {
    const result = parse({ qrContent: 'CBE FT26195DBK5W81465291' });

    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain('qrType');
  });

  it('rejects qrType without qrContent', () => {
    const result = parse({ qrType: 'reference' });

    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain('qrContent');
  });

  it('rejects a qrType outside the supported set', () => {
    const result = parse({ qrContent: 'x', qrType: 'barcode' });

    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain('qrType');
  });

  it('caps qrContent at 2048 characters', () => {
    const result = parse({ qrContent: 'a'.repeat(2049), qrType: 'unknown' });

    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain('qrContent');
  });

  it('trims surrounding whitespace on qrContent', () => {
    const result = parse({ qrContent: '  CBE FT26195DBK5W81465291  ', qrType: 'reference' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.qrContent).toBe('CBE FT26195DBK5W81465291');
    }
  });
});

describe('CreateVerificationDtoSchema — client OCR fields', () => {
  it('accepts clientOcrText + clientOcrConfidence together', () => {
    const result = parse({
      clientOcrText: 'CBE transfer FT26195DBK5W81465291',
      clientOcrConfidence: 0.9,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.clientOcrConfidence).toBe(0.9);
    }
  });

  it('rejects clientOcrText without confidence', () => {
    const result = parse({ clientOcrText: 'CBE transfer' });

    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain('clientOcrConfidence');
  });

  it('rejects confidence without text', () => {
    const result = parse({ clientOcrConfidence: 0.9 });

    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain('clientOcrText');
  });

  it('rejects an out-of-range confidence', () => {
    expect(issuePaths(parse({ clientOcrText: 'text', clientOcrConfidence: 1.2 }))).toContain(
      'clientOcrConfidence',
    );
    expect(issuePaths(parse({ clientOcrText: 'text', clientOcrConfidence: -0.1 }))).toContain(
      'clientOcrConfidence',
    );
  });

  it('caps clientOcrText at 20000 characters', () => {
    const result = parse({ clientOcrText: 'a'.repeat(20001), clientOcrConfidence: 0.9 });

    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain('clientOcrText');
  });
});
