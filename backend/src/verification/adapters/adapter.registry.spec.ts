// ============================================================
// Yene Verify — AdapterRegistry Unit Tests
//
// Uses StubAdapter instances under different bank codes; no real
// adapter logic exists yet (13D.*). No DB, no Redis, no HTTP.
// ============================================================

import { AdapterRegistry } from './adapter.registry';
import { StubAdapter } from './testing/stub.adapter';
import { BankAdapterNotFoundError } from '../../common/errors/domain-errors';
import type { AdapterConfigSource } from './adapter.base';

/** Minimum config surface the adapters read. */
const configSource: AdapterConfigSource = {
  bankAdapters: { timeoutMs: 250, retries: 0 },
} as never;

describe('AdapterRegistry (unit)', () => {
  it('register() then get() returns the same instance', () => {
    const registry = new AdapterRegistry();
    const adapter = new StubAdapter(configSource, { bankCode: 'CBE' });
    registry.register(adapter);

    expect(registry.get('CBE')).toBe(adapter);
  });

  it('register() is idempotent — re-registering replaces', () => {
    const registry = new AdapterRegistry();
    const first = new StubAdapter(configSource, { bankCode: 'CBE' });
    const second = new StubAdapter(configSource, { bankCode: 'CBE' });
    registry.register(first);
    registry.register(second);

    expect(registry.get('CBE')).toBe(second);
  });

  it('get() throws BankAdapterNotFoundError for an unregistered code', () => {
    const registry = new AdapterRegistry();
    expect(() => registry.get('TELEBIRR')).toThrow(BankAdapterNotFoundError);
  });

  it('detectAll() returns zero matches when nothing detects', () => {
    const registry = new AdapterRegistry();
    registry.register(new StubAdapter(configSource, { detectKeywords: ['CBE-FT'] }));

    expect(registry.detectAll('telebirr receipt')).toHaveLength(0);
  });

  it('detectAll() returns one match when a single adapter detects', () => {
    const registry = new AdapterRegistry();
    registry.register(
      new StubAdapter(configSource, {
        bankCode: 'CBE' as never,
        detectKeywords: ['CBE-FT'],
      }),
    );

    const matches = registry.detectAll('CBE-FT1234567890 transfer');
    expect(matches).toHaveLength(1);
    expect(matches[0].adapter.bankCode).toBe('CBE');
    expect(matches[0].adapter).toBeInstanceOf(StubAdapter);
  });

  it('detectAll() returns many matches sorted by confidence', () => {
    const registry = new AdapterRegistry();
    registry.register(
      new StubAdapter(configSource, {
        bankCode: 'CBE' as never,
        detectKeywords: ['CBE-FT'],
      }),
    );
    registry.register(
      new StubAdapter(configSource, {
        bankCode: 'TELEBIRR' as never,
        detectKeywords: ['telebirr'],
      }),
    );

    // Text containing both keywords: two matches are reported.
    const matches = registry.detectAll('CBE-FT1234 on telebirr login page');
    expect(matches.length).toBe(2);
    expect(matches[0].confidence).toBeGreaterThanOrEqual(matches[1].confidence);
  });

  it('detectBest() picks the longest matched keyword among several', () => {
    const registry = new AdapterRegistry();

    // Confidences scale with the longest matched keyword length, so
    // a short keyword loses against a longer one in the same text.
    registry.register(
      new StubAdapter(configSource, {
        bankCode: 'CBE' as never,
        detectKeywords: ['CBE', 'CBE-FT'],
      }),
    );
    registry.register(
      new StubAdapter(configSource, {
        bankCode: 'ABYSSINIA' as never,
        detectKeywords: ['CBE'],
      }),
    );

    const best = registry.detectBest('visit your CBE-FT portal');
    expect(best).not.toBeNull();
    expect(best!.adapter.bankCode).toBe('CBE');
  });

  it('detectBest() returns null when no adapter detects', () => {
    const registry = new AdapterRegistry();
    registry.register(new StubAdapter(configSource, { detectKeywords: ['CBE-FT'] }));

    expect(registry.detectBest('nothing relevant here')).toBeNull();
  });

  it('a broken adapter.detect() does not poison routing`', () => {
    const registry = new AdapterRegistry();

    const broken = {
      bankCode: 'DASHEN' as never,
      displayName: 'Broken',
      detect: () => {
        throw new Error('boom');
      },
      extractReference: () => null,
      verify: jest.fn(),
      health: jest.fn(),
    };
    registry.register(broken as never);

    const healthy = new StubAdapter(configSource, {
      bankCode: 'CBE' as never,
      detectKeywords: ['CBE-FT'],
    });
    registry.register(healthy);

    const matches = registry.detectAll('CBE-FT1234 text');
    expect(matches).toHaveLength(1);
    expect(matches[0].adapter).toBe(healthy);
  });
});
