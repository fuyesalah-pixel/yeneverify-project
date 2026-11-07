// ============================================================
// Yene Verify — Label Extraction Integration Tests
//
// Realistic OCR snippets (digits sanitized) through the real
// adapters, one per bank, proving the label-first path lands the
// reference Fuad's receipt report documented. No HTTP, no
// browser: extraction is pure text processing.
// ============================================================

import { AbyssiniaAdapter } from '../../src/verification/adapters/abyssinia/abyssinia.adapter';
import { AwashAdapter } from '../../src/verification/adapters/awash/awash.adapter';
import { CbeAdapter } from '../../src/verification/adapters/cbe/cbe.adapter';
import { DashenAdapter } from '../../src/verification/adapters/dashen/dashen.adapter';
import { MpesaAdapter } from '../../src/verification/adapters/mpesa/mpesa.adapter';
import { TelebirrAdapter } from '../../src/verification/adapters/telebirr/telebirr.adapter';
import { ZemenAdapter } from '../../src/verification/adapters/zemen/zemen.adapter';

const http = { get: jest.fn(), head: jest.fn() };
const pool = { getPage: jest.fn(), release: jest.fn(), health: jest.fn() };

const config = {
  bankAdapters: { timeoutMs: 250, retries: 0, userAgent: 'yene-verify-test/1.0', mock: false },
  abyssinia: { endpoints: [] },
  awash: { endpoints: [] },
  dashen: { endpoints: [] },
  mpesa: { endpoints: [] },
  zemen: { endpoints: [] },
  telebirr: { headlessEnabled: false, browserPoolSize: 1, maxConcurrent: 1 },
} as never;

const abyssinia = new AbyssiniaAdapter(http as never, config);
const awash = new AwashAdapter(http as never, config);
const cbe = new CbeAdapter(http as never, config);
const dashen = new DashenAdapter(http as never, config);
const mpesa = new MpesaAdapter(http as never, config);
const telebirr = new TelebirrAdapter(pool as never, config);
const zemen = new ZemenAdapter(http as never, config);

describe('label extraction (integration)', () => {
  it('Abyssinia receipt extracted correctly', () => {
    const ocr = [
      'Bank of Abyssinia',
      'Transaction Reference: FT26201XP8NP',
      'Amount: 1,500.00 ETB',
    ].join('\n');

    expect(abyssinia.extractReference(ocr)).toBe('FT26201XP8NP');
  });

  it('Awash receipt extracted correctly', () => {
    const ocr = ['Awash Bank', 'Transaction ID: 260310152465470', 'Amount: 350.00 ETB'].join('\n');

    expect(awash.extractReference(ocr)).toBe('260310152465470');
  });

  it('Dashen receipt extracted correctly', () => {
    const ocr = ['Dashen Bank', 'FT Ref: F57LTWI2620600WL', 'Amount: 900.00 ETB'].join('\n');

    expect(dashen.extractReference(ocr)).toBe('F57LTWI2620600WL');
  });

  it('Telebirr receipt extracted correctly', () => {
    const ocr = ['Telebirr', 'Transaction Number: DFD1U83ETH', 'Amount: 120.00 ETB'].join('\n');

    expect(telebirr.extractReference(ocr)).toBe('DFD1U83ETH');
  });

  it('M-Pesa receipt extracted correctly', () => {
    const ocr = ['M-Pesa', 'Transaction ID: QGH4XW7P2L', 'Amount: 75.00 ETB'].join('\n');

    expect(mpesa.extractReference(ocr)).toBe('QGH4XW7P2L');
  });

  it('Zemen receipt extracted correctly', () => {
    const ocr = ['Zemen Bank', 'Transaction ID: 108IBET252931385', 'Amount: 2,000.00 ETB'].join(
      '\n',
    );

    expect(zemen.extractReference(ocr)).toBe('108IBET252931385');
  });

  it('CBE receipt still extracted correctly (unchanged pattern)', () => {
    const ocr = [
      'Commercial Bank of Ethiopia',
      'FT26195DBK5W81465291',
      'Amount: 5,500.00 ETB',
    ].join('\n');

    expect(cbe.extractReference(ocr)).toBe('FT26195DBK5W81465291');
  });
});
