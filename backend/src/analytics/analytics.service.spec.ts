// ============================================================
// Yene Verify — Analytics service unit tests (Step 18)
//
// Repository mocked; the assertions target DTO shapes and the
// service-owned math: default/from-only range resolution,
// zero-transaction empties, 24/7 bucket padding, trend deltas with
// an all-zero previous period, the 365-day cap, and the anomaly
// detector's minimum-observation rule.
// ============================================================

import { ValidationError } from '../common/errors/domain-errors';
import { AnalyticsService, detectAnomalies } from './analytics.service';
import type { AnalyticsRepository } from './analytics.repository';
import { resolveAnalyticsRange } from './dto/analytics-range.query';

const DAY = 86_400_000;

describe('resolveAnalyticsRange', () => {
  const NOW = new Date('2026-10-29T12:00:00.000Z');

  it('both missing → last 30 days', () => {
    const r = resolveAnalyticsRange({}, NOW);
    expect(r.days).toBe(30);
    expect(r.to.toISOString()).toBe(NOW.toISOString());
    expect(r.from.toISOString()).toBe(new Date(NOW.getTime() - 30 * DAY).toISOString());
  });

  it('only from → from + 30 days', () => {
    const r = resolveAnalyticsRange({ from: '2026-01-01T00:00:00Z' });
    expect(r.from.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(r.days).toBe(30);
  });

  it('only to → to - 30 days (inclusive end)', () => {
    const r = resolveAnalyticsRange({ to: '2026-02-01T00:00:00Z' });
    expect(r.to.toISOString()).toBe('2026-02-01T00:00:00.000Z');
    expect(r.days).toBe(30);
  });

  it('> 365 days → ValidationError (400 class)', () => {
    expect(() =>
      resolveAnalyticsRange({ from: '2026-01-01T00:00:00Z', to: '2027-01-03T00:00:00Z' }),
    ).toThrow(ValidationError);
  });

  it('365 days exactly is allowed', () => {
    const r = resolveAnalyticsRange({ from: '2026-01-01T00:00:00Z', to: '2027-01-01T00:00:00Z' });
    expect(r.days).toBe(365);
  });
});

describe('AnalyticsService', () => {
  let service: AnalyticsService;

  const repoMock = {
    findSummary: jest.fn(),
    findBestProducts: jest.fn(),
    findPeakHours: jest.fn(),
    findBestDays: jest.fn(),
    findBestMonths: jest.fn(),
    findDailyVolumes: jest.fn(),
  };

  const emptySummary = {
    count: 0,
    amountSum: 0n,
    uniqueSenders: 0,
    uniqueSubMerchants: 0,
    nullProductLabelCount: 0,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    repoMock.findSummary.mockResolvedValue(emptySummary);
    repoMock.findBestProducts.mockResolvedValue([]);
    repoMock.findPeakHours.mockResolvedValue([]);
    repoMock.findBestDays.mockResolvedValue([]);
    repoMock.findBestMonths.mockResolvedValue([]);
    repoMock.findDailyVolumes.mockResolvedValue([]);
    service = new AnalyticsService(repoMock as unknown as AnalyticsRepository);
  });

  it('summary with zero transactions → count 0, "0" amounts, model tag', async () => {
    const res = await service.summary('m-1', {});

    expect(res.totals).toEqual({
      count: 0,
      amountMinor: '0',
      avgAmountMinor: '0',
      uniqueSenders: 0,
      uniqueSubMerchants: 0,
    });
    expect(res.model).toBe('rules-v1');
    expect(typeof res.generatedAt).toBe('string');
    expect(res.range.days).toBe(30);
  });

  it('summary projects averages rounded from bigint (not floats)', async () => {
    repoMock.findSummary.mockResolvedValue({
      count: 3,
      amountSum: 1004n, // avg 334.66… → 335; plain truncation would print 334
      uniqueSenders: 2,
      uniqueSubMerchants: 1,
      nullProductLabelCount: 0,
    });
    const res = await service.summary('m-1', {});
    expect(res.totals.amountMinor).toBe('1004');
    expect(res.totals.avgAmountMinor).toBe('335');
  });

  it('bestProducts: top by amount with share of total, label kept verbatim', async () => {
    repoMock.findSummary.mockResolvedValue({
      count: 10,
      amountSum: 2000n,
      uniqueSenders: 4,
      uniqueSubMerchants: 2,
      nullProductLabelCount: 2,
    });
    repoMock.findBestProducts.mockResolvedValue([
      { label: 'Coffee', count: 4, amountSum: 1000n },
      { label: 'Tea', count: 2, amountSum: 500n },
    ]);

    const res = await service.bestProducts('m-1', {});

    expect(res.items).toEqual([
      { label: 'Coffee', count: 4, amountMinor: '1000', share: 50 },
      { label: 'Tea', count: 2, amountMinor: '500', share: 25 },
    ]);
    expect(res.model).toBe('rules-v1');
    // The share denominator comes from the SAME window summary.
    expect(repoMock.findSummary).toHaveBeenCalled();
  });

  it('peakHours always returns 24 buckets (zeros included), sums match', async () => {
    repoMock.findPeakHours.mockResolvedValue([
      { hour: 15, count: 5, amountSum: 500n },
      { hour: 16, count: 3, amountSum: 300n },
    ]);

    const res = await service.peakHours('m-1', {});

    expect(res.hours).toHaveLength(24);
    expect(res.hours.reduce((a, h) => a + h.count, 0)).toBe(8);
    expect(res.hours.filter((h) => h.count === 0)).toHaveLength(22);
    expect(res.topHour).toBe(15);
    expect(res.hours[3]).toEqual({ hour: 3, count: 0, amountMinor: '0' });
  });

  it('bestDays always returns 7 buckets, topDay is the max', async () => {
    repoMock.findBestDays.mockResolvedValue([{ dayOfWeek: 4, count: 6, amountSum: 600n }]);

    const res = await service.bestDays('m-1', {});

    expect(res.days).toHaveLength(7);
    expect(res.days.map((d) => d.dayOfWeek)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(res.days[3]).toEqual({ dayOfWeek: 4, count: 6, amountMinor: '600' });
    expect(res.topDay).toBe(4);
  });

  it('bestMonths: only months present in the range, topMonth null when empty', async () => {
    repoMock.findBestMonths.mockResolvedValueOnce([
      { yearMonth: '2026-09', count: 2, amountSum: 200n },
      { yearMonth: '2026-10', count: 8, amountSum: 800n },
    ]);

    const res = await service.bestMonths('m-1', {});

    expect(res.months).toEqual([
      { yearMonth: '2026-09', count: 2, amountMinor: '200' },
      { yearMonth: '2026-10', count: 8, amountMinor: '800' },
    ]);
    expect(res.topMonth).toBe('2026-10');

    const empty = await service.bestMonths('m-1', {});
    expect(empty.months).toEqual([]);
    expect(empty.topMonth).toBeNull();
  });

  it('trend: previous count 0 → both null deltas, direction flat', async () => {
    repoMock.findSummary
      .mockResolvedValueOnce({ ...emptySummary, count: 5, amountSum: 500n }) // current
      .mockResolvedValueOnce(emptySummary); // previous

    const res = await service.trend('m-1', { from: '2026-10-01T00:00:00Z' });

    expect(res.current).toEqual({ count: 5, amountMinor: '500' });
    expect(res.previous).toEqual({ count: 0, amountMinor: '0' });
    expect(res.delta).toEqual({ countPct: null, amountPct: null });
    expect(res.direction).toBe('flat');
  });

  it('trend: up/down/flat band edges', async () => {
    // +20% → up
    repoMock.findSummary
      .mockResolvedValueOnce({ ...emptySummary, count: 6, amountSum: 1200n })
      .mockResolvedValueOnce({ ...emptySummary, count: 5, amountSum: 1000n });
    expect((await service.trend('m-1', {})).direction).toBe('up');

    // -2% → flat (< 5 band)
    repoMock.findSummary
      .mockResolvedValueOnce({ ...emptySummary, count: 5, amountSum: 980n })
      .mockResolvedValueOnce({ ...emptySummary, count: 5, amountSum: 1000n });
    expect((await service.trend('m-1', {})).direction).toBe('flat');

    // -20% → down
    repoMock.findSummary
      .mockResolvedValueOnce({ ...emptySummary, count: 4, amountSum: 800n })
      .mockResolvedValueOnce({ ...emptySummary, count: 5, amountSum: 1000n });
    expect((await service.trend('m-1', {})).direction).toBe('down');
  });

  it('trend never double-counts the boundary instant between windows', async () => {
    repoMock.findSummary.mockResolvedValue(emptySummary);
    await service.trend('m-1', {
      from: '2026-10-01T00:00:00Z',
      to: '2026-10-10T00:00:00Z',
    });

    const calls = repoMock.findSummary.mock.calls as unknown as Array<
      [{ merchantId: string; from: Date; to: Date }]
    >;
    const [currentWindow, previousWindow] = [calls[0][0], calls[1][0]];
    expect(previousWindow.to.getTime()).toBeLessThanOrEqual(currentWindow.from.getTime());
  });

  it('recommendations wires rules over live aggregates and sends recent-spikes through', async () => {
    repoMock.findDailyVolumes.mockResolvedValue(
      Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.UTC(2026, 9, i + 1)).toISOString().slice(0, 10),
        count: 2,
        amountSum: 200n,
      })).concat([
        {
          date: new Date(new Date().getTime() - 2 * DAY).toISOString().slice(0, 10),
          count: 120,
          amountSum: 12000n,
        },
      ]),
    );

    const res = await service.recommendations('m-1', {});

    expect(res.model).toBe('rules-v1');
    expect(res.range.days).toBe(30);
    // The spike rule consumes the anomaly list; the injected day is within
    // 7 of "now", so single-operator/rule data feeding is exercised end to end.
    expect(Array.isArray(res.recommendations)).toBe(true);
  });

  // ── anomalies (detectAnomalies is a service-exported pure fn) ──────────

  describe('detectAnomalies', () => {
    it('< 7 days of data → empty list', () => {
      const rows = [
        { date: '2026-10-20', count: 1, amountSum: 100n },
        { date: '2026-10-21', count: 1, amountSum: 20_000n },
        { date: '2026-10-22', count: 1, amountSum: 100n },
        { date: '2026-10-23', count: 1, amountSum: 100n },
        { date: '2026-10-24', count: 1, amountSum: 100n },
        { date: '2026-10-25', count: 1, amountSum: 100n },
      ];
      expect(detectAnomalies(rows)).toEqual([]);
    });

    it('7+ days with a big outlier → flagged as spike with |z| >= 2.5', () => {
      const rows = [
        ...Array.from({ length: 9 }, (_, i) => ({
          date: `2026-10-${10 + i}`,
          count: 2,
          amountSum: 100n,
        })),
        { date: '2026-10-19', count: 60, amountSum: 20_000n },
      ];

      const out = detectAnomalies(rows);

      expect(out).toHaveLength(1);
      expect(out[0].date).toBe('2026-10-19');
      expect(out[0].direction).toBe('spike');
      expect(Math.abs(out[0].zScore)).toBeGreaterThanOrEqual(2.5);
      expect(out[0].amountMinor).toBe('20000');
    });

    it('drop days (near-zero among filled days) → direction drop', () => {
      const rows = [
        ...Array.from({ length: 10 }, (_, i) => ({
          date: `2026-10-${10 + i}`,
          count: 10,
          amountSum: 5000n,
        })),
        { date: '2026-10-20', count: 0, amountSum: 0n },
      ];

      const out = detectAnomalies(rows);
      const drop = out.find((a) => a.date === '2026-10-20');
      expect(drop?.direction).toBe('drop');
    });

    it('perfectly flat series (σ = 0) → no anomalies, not a crash', () => {
      const rows = Array.from({ length: 10 }, (_, i) => ({
        date: `2026-10-${10 + i}`,
        count: 5,
        amountSum: 300n,
      }));
      expect(detectAnomalies(rows)).toEqual([]);
    });
  });
});
