// ============================================================
// Yene Verify — Telebirr Adapter Unit Tests
//
// BrowserPool and pages are fully mocked — no real Chromium in
// any test (a real-launch check lives in browser-pool.spec and is
// still mock-backed; manual end-to-end against Telebirr happens
// outside the unit suite).
// ============================================================

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { TelebirrAdapter } from './telebirr.adapter';
import type {
  VerifyInput,
  VerifyResult,
  VerifyResultFailure,
  VerifyResultSuccess,
} from '../adapter.interface';
import type { AppConfigService } from '../../../config/config.service';
import { AdapterRegistry } from '../adapter.registry';

function successHtml(): string {
  return readFileSync(resolve(__dirname, '__fixtures__/receipt-success.html'), 'utf8');
}
function notFoundHtml(): string {
  return readFileSync(resolve(__dirname, '__fixtures__/receipt-not-found.html'), 'utf8');
}

const input: VerifyInput = {
  reference: 'DEV230123HH',
  referenceNormalized: 'DEV230123HH',
  rawOcrText: 'telebirr payment DEV230123HH to Selam Coffee',
  merchantId: 'merchant-1',
  requestId: 'req-tb-1',
};

const config: AppConfigService = {
  telebirr: { headlessEnabled: true, browserPoolSize: 2, maxConcurrent: 2 },
  bankAdapters: { timeoutMs: 250, retries: 0, userAgent: 'yene-verify-test/1.0', mock: false },
} as never;

type FakePage = {
  goto: jest.Mock;
  waitForFunction: jest.Mock;
  content: jest.Mock;
  close: jest.Mock;
};

type FakePool = {
  getPage: jest.Mock;
  release: jest.Mock;
  health: jest.Mock;
};

const fakePage = (): FakePage => ({
  goto: jest.fn().mockResolvedValue(undefined),
  waitForFunction: jest.fn().mockResolvedValue(undefined),
  content: jest.fn(),
  close: jest.fn().mockResolvedValue(undefined),
});

const fakePool = (page: FakePage | null): FakePool => ({
  getPage: page
    ? jest.fn().mockResolvedValue(page)
    : jest.fn().mockRejectedValue(new Error('pool down')),
  release: jest.fn(),
  health: jest.fn().mockResolvedValue(true),
});

const makeAdapter = (pool: FakePool, cfg?: Partial<AppConfigService>): TelebirrAdapter =>
  new TelebirrAdapter(
    pool as unknown as never,
    {
      telebirr: { ...config.telebirr, ...(cfg?.telebirr ?? {}) },
      bankAdapters: { ...config.bankAdapters, ...(cfg?.bankAdapters ?? {}) },
    } as never,
  );

const failureOf = (result: VerifyResult): VerifyResultFailure => {
  if (result.status === 'VERIFIED') throw new Error('expected a failure result');
  return result;
};

const successOf = (result: VerifyResult): VerifyResultSuccess => {
  if (result.status !== 'VERIFIED') throw new Error('expected a success result');
  return result;
};

describe('TelebirrAdapter detect/extract (unit)', () => {
  const adapter = makeAdapter(fakePool(null));

  it('detect() true for "Telebirr", "Ethio Telecom", "ethiotelecom"', () => {
    expect(adapter.detect('telebirr payment received')).toBe(true);
    expect(adapter.detect('Ethio Telecom transaction notice')).toBe(true);
    expect(adapter.detect('receipt from ethiotelecom')).toBe(true);
  });

  it('detect() false for CBE', () => {
    expect(adapter.detect('CBE transfer FT26195DBK5W81465291')).toBe(false);
  });

  it('extractReference() finds DEV-prefixed references', () => {
    expect(adapter.extractReference('telebirr ref DEV230123HH')).toBe('DEV230123HH');
  });

  it('extractReference() finds TBR-prefixed references', () => {
    expect(adapter.extractReference('telebirr ref TBR99001122')).toBe('TBR99001122');
  });

  // 14.3 Part A: suffix is [0-9A-Z] — G-Z letters must survive extraction.
  it('extractReference() keeps G-Z letters (no hex-only truncation)', () => {
    expect(adapter.extractReference('telebirr ref DEV6HKJX7KM2')).toBe('DEV6HKJX7KM2');
    expect(adapter.extractReference('telebirr ref TBR98PY7WWQK')).toBe('TBR98PY7WWQK');
  });

  it('extractReference() accepts the relaxed alnum shape (no DEV/TBR prefix)', () => {
    expect(adapter.extractReference('telebirr ref DFD1U83ETH')).toBe('DFD1U83ETH');
    expect(adapter.extractReference('telebirr ref CBE26195DBK5')).toBe('CBE26195DBK5');
  });

  it('extractReference() returns null when no uppercase alnum run exists', () => {
    expect(adapter.extractReference('telebirr payment')).toBeNull();
  });

  // Phase 2: label-anchored extraction (real format DFD1U83ETH).
  it('extracts a labeled Telebirr reference', () => {
    expect(adapter.extractReference('Transaction Number: DFD1U83ETH')).toBe('DFD1U83ETH');
  });

  it('extracts an unlabeled Telebirr reference via the relaxed regex', () => {
    expect(adapter.extractReference('Telebirr transfer DFD1U83ETH')).toBe('DFD1U83ETH');
  });

  it('returns null for a wrong-bank reference below the 8-char floor', () => {
    expect(adapter.extractReference('ref TBR9900')).toBeNull();
  });

  it('returns null for empty OCR text', () => {
    expect(adapter.extractReference('')).toBeNull();
  });

  it('falls through to the regex when the labeled value is invalid', () => {
    // Lowercase text: the fallback shape is uppercase-only, so nothing survives.
    expect(adapter.extractReference('transaction number: @@@')).toBeNull();
  });
});

describe('TelebirrAdapter doVerify (unit)', () => {
  it('ERROR retryable=true when headless is disabled', async () => {
    const pool = fakePool(null);
    const adapter = makeAdapter(pool, { telebirr: { headlessEnabled: false } as never });

    const failure = failureOf(await adapter.verify(input));

    expect(failure.status).toBe('ERROR');
    expect(failure.errorCode).toBe('BANK_ADAPTER_UNAVAILABLE');
    expect(failure.retryable).toBe(true);
    expect(pool.getPage).not.toHaveBeenCalled();
  });

  it('VERIFIED on the success fixture with bigint amount', async () => {
    const page = fakePage();
    page.content.mockResolvedValue(successHtml());
    const pool = fakePool(page);
    const adapter = makeAdapter(pool);

    const success = successOf(await adapter.verify(input));

    expect(success.bankReference).toBe('DEV230123HH');
    expect(success.amountMinor).toBe(230000n); // bigint
    expect(success.currency).toBe('ETB');
    expect(success.senderName).toBe('Abebe Kebede');
    expect(success.receiverName).toBe('Selam Coffee');
    expect(success.paidAt.toISOString()).toBe('2026-07-14T11:08:00.000Z');
    expect(success.metadata.attempts).toBe(1);

    expect(page.goto).toHaveBeenCalledWith(
      'https://transactioninfo.ethiotelecom.et/receipt/DEV230123HH',
      expect.objectContaining({ waitUntil: 'networkidle2', timeout: 250 }),
    );
  });

  it('FAKE on the invalid-receipt page — not retried', async () => {
    const page = fakePage();
    page.content.mockResolvedValue(notFoundHtml());
    const pool = fakePool(page);
    const adapter = makeAdapter(pool, { bankAdapters: { retries: 2 } as never });

    const failure = failureOf(await adapter.verify(input));

    expect(failure.status).toBe('FAKE');
    expect(failure.errorCode).toBe('BANK_REFERENCE_NOT_FOUND');
    expect(failure.retryable).toBe(false);
    expect(failure.metadata?.attempts).toBe(1);
    expect(page.goto).toHaveBeenCalledTimes(1); // one network journey only
  });

  it('ERROR retryable=true with a throwing pool, and the close/release path is untouched', async () => {
    const pool = fakePool(null); // getPage rejects
    const adapter = makeAdapter(pool, { bankAdapters: { retries: 0 } as never });

    const failure = failureOf(await adapter.verify(input));

    expect(failure.status).toBe('ERROR');
    expect(failure.errorCode).toBe('BANK_ADAPTER_ERROR');
    expect(failure.retryable).toBe(true);
    expect(pool.release).not.toHaveBeenCalled(); // failed acquire freed itself
  });

  it('closes the page and releases the pool slot even when content() throws', async () => {
    const page = fakePage();
    page.content.mockRejectedValue(new Error('browser crashed mid-render'));
    const pool = fakePool(page);
    const adapter = makeAdapter(pool, { bankAdapters: { retries: 0 } as never });

    const failure = failureOf(await adapter.verify(input));

    expect(failure.status).toBe('ERROR');
    expect(failure.retryable).toBe(true);
    expect(page.close).toHaveBeenCalledTimes(1);
    expect(pool.release).toHaveBeenCalledTimes(1);
  });
});

describe('TelebirrAdapter health (unit)', () => {
  it('delegates to the pool when headless is enabled', async () => {
    const pool = fakePool(null);
    pool.health.mockResolvedValue(true);

    expect(await makeAdapter(pool).health()).toBe(true);
    expect(pool.health).toHaveBeenCalledTimes(1);
  });

  it('is healthy without the pool when headless is disabled', async () => {
    const pool = fakePool(null);

    expect(
      await makeAdapter(pool, { telebirr: { headlessEnabled: false } as never }).health(),
    ).toBe(true);
    expect(pool.health).not.toHaveBeenCalled();
  });
});

describe('TelebirrAdapter registry integration (unit)', () => {
  it('detectBest() routes Telebirr-shaped OCR to TelebirrAdapter', () => {
    const registry = new AdapterRegistry(makeAdapter(fakePool(null)));

    const best = registry.detectBest('Telebirr payment DEV230123HH');
    expect(best).not.toBeNull();
    expect(best!.adapter).toBeInstanceOf(TelebirrAdapter);
  });
});
