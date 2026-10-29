// ============================================================
// Yene Verify — Rules engine unit tests (Step 18)
//
// Pure function tests: each rule fires exactly when its condition
// holds, produces no duplicates, and the engine caps at 5 items.
// ============================================================

import { generateRecommendations } from './rules-engine';
import type { RuleInputs } from './recommendations';

function inputs(overrides: Partial<RuleInputs> = {}): RuleInputs {
  const peakHours = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    count: 1,
    amountMinor: 100n,
  }));
  return {
    summary: {
      count: 100,
      amountMinor: 10_000n,
      uniqueSenders: 5,
      uniqueSubMerchants: 3,
      nullProductLabelCount: 0,
    },
    peakHours,
    bestDays: Array.from({ length: 7 }, (_, i) => ({ dayOfWeek: i + 1, count: 10 })),
    trend: { direction: 'flat', amountPct: 1 },
    anomalies: [],
    ...overrides,
  };
}

describe('rules engine', () => {
  it('fires nothing on healthy, balanced input', () => {
    // 100 txs spread evenly across hours/days → no 40% window, no weekend
    // excess (weekday 70/5 = 14/day vs weekend 20/2 = 10/day < 1.5).
    expect(generateRecommendations(inputs({}))).toEqual([]);
  });

  it('peak-hour-cluster: 3-hour window holding >= 40% fires once', () => {
    const peakHours = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      count: h >= 15 && h <= 17 ? 14 : 2, // 15,16,17 → 42/52 > 40%
      amountMinor: 100n,
    }));
    const recs = generateRecommendations(inputs({ peakHours }));
    const fired = recs.filter((r) => r.id === 'peak-hour-cluster');
    expect(fired).toHaveLength(1);
    expect(fired[0].severity).toBe('opportunity');
  });

  it('peak-hour-cluster: 39% window does NOT fire', () => {
    const peakHours = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      count: h >= 15 && h <= 17 ? 13 : 2, // 39/65 < 40%
      amountMinor: 100n,
    }));
    expect(generateRecommendations(inputs({ peakHours })).map((r) => r.id)).not.toContain(
      'peak-hour-cluster',
    );
  });

  it('weekend-heavy: per-day ratio >= 1.5 fires', () => {
    // weekend 60 (30/day) vs weekday 40 (8/day) → 3.75
    const recs = generateRecommendations(
      inputs({
        bestDays: [
          { dayOfWeek: 1, count: 8 },
          { dayOfWeek: 2, count: 8 },
          { dayOfWeek: 3, count: 8 },
          { dayOfWeek: 4, count: 8 },
          { dayOfWeek: 5, count: 8 },
          { dayOfWeek: 6, count: 30 },
          { dayOfWeek: 7, count: 30 },
        ],
      }),
    );
    const fired = recs.filter((r) => r.id === 'weekend-heavy');
    expect(fired).toHaveLength(1);
  });

  it('trend-down: direction down with amountPct <= -15 fires', () => {
    const recs = generateRecommendations(
      inputs({ trend: { direction: 'down', amountPct: -18.5 } }),
    );
    const fired = recs.filter((r) => r.id === 'trend-down');
    expect(fired).toHaveLength(1);
    expect(fired[0].severity).toBe('warning');
  });

  it('trend-down: -14% does NOT fire (rule edge)', () => {
    expect(
      generateRecommendations(inputs({ trend: { direction: 'down', amountPct: -14 } })).map(
        (r) => r.id,
      ),
    ).not.toContain('trend-down');
  });

  it('tag-products: >= 30% null product labels fires', () => {
    const recs = generateRecommendations(
      inputs({
        summary: {
          count: 10,
          amountMinor: 100n,
          uniqueSenders: 1,
          uniqueSubMerchants: 1,
          nullProductLabelCount: 4,
        },
      }),
    );
    expect(recs.some((r) => r.id === 'tag-products')).toBe(true);
  });

  it('tag-products: 29% does NOT fire', () => {
    const recs = generateRecommendations(
      inputs({
        summary: {
          count: 100,
          amountMinor: 100n,
          uniqueSenders: 1,
          uniqueSubMerchants: 1,
          nullProductLabelCount: 29,
        },
      }),
    );
    expect(recs.map((r) => r.id)).not.toContain('tag-products');
  });

  it('recent-spike: fires only for spikes within the last 7 days', () => {
    const fired = generateRecommendations(
      inputs({
        anomalies: [{ date: '2026-10-28', direction: 'spike', withinLast7Days: true }],
      }),
    );
    expect(fired.filter((r) => r.id === 'recent-spike')).toHaveLength(1);

    // Old spike (outside the 7-day lens) stays quiet.
    const quiet = generateRecommendations(
      inputs({
        anomalies: [{ date: '2026-10-01', direction: 'spike', withinLast7Days: false }],
      }),
    );
    expect(quiet.map((r) => r.id)).not.toContain('recent-spike');
  });

  it('single-operator: >100 txs from exactly 1 teammate fires; 2 teammates silences it', () => {
    const single = generateRecommendations(
      inputs({
        summary: {
          count: 150,
          amountMinor: 100n,
          uniqueSenders: 2,
          uniqueSubMerchants: 1,
          nullProductLabelCount: 0,
        },
      }),
    );
    expect(single.filter((r) => r.id === 'single-operator')).toHaveLength(1);

    const spread = generateRecommendations(
      inputs({
        summary: {
          count: 150,
          amountMinor: 100n,
          uniqueSenders: 2,
          uniqueSubMerchants: 2,
          nullProductLabelCount: 0,
        },
      }),
    );
    expect(spread.map((r) => r.id)).not.toContain('single-operator');

    // 100 exactly (not >100) does NOT fire.
    const boundary = generateRecommendations(
      inputs({
        summary: {
          count: 100,
          amountMinor: 100n,
          uniqueSenders: 2,
          uniqueSubMerchants: 1,
          nullProductLabelCount: 0,
        },
      }),
    );
    expect(boundary.map((r) => r.id)).not.toContain('single-operator');
  });

  it('caps the list at 5 recommendations even when all 6 rules fire', () => {
    const peakHours = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      count: h >= 15 && h <= 17 ? 20 : 1,
      amountMinor: 100n,
    }));
    const recs = generateRecommendations(
      inputs({
        peakHours,
        summary: {
          count: 120,
          amountMinor: 100n,
          uniqueSenders: 1,
          uniqueSubMerchants: 1,
          nullProductLabelCount: 50,
        },
        bestDays: [
          { dayOfWeek: 1, count: 6 },
          { dayOfWeek: 2, count: 6 },
          { dayOfWeek: 3, count: 6 },
          { dayOfWeek: 4, count: 6 },
          { dayOfWeek: 5, count: 6 },
          { dayOfWeek: 6, count: 45 },
          { dayOfWeek: 7, count: 45 },
        ],
        trend: { direction: 'down', amountPct: -30 },
        anomalies: [{ date: '2026-10-28', direction: 'spike', withinLast7Days: true }],
      }),
    );
    expect(recs).toHaveLength(5);
    // No id appears twice.
    expect(new Set(recs.map((r) => r.id)).size).toBe(recs.length);
  });

  it('every emitted recommendation carries id/severity/title/body', () => {
    const recs = generateRecommendations(
      inputs({
        trend: { direction: 'down', amountPct: -50 },
        anomalies: [{ date: '2026-10-28', direction: 'spike', withinLast7Days: true }],
      }),
    );
    for (const r of recs) {
      expect(typeof r.id).toBe('string');
      expect(['info', 'opportunity', 'warning']).toContain(r.severity);
      expect(r.title.length).toBeGreaterThan(0);
      expect(r.body.length).toBeGreaterThan(0);
    }
  });
});
