// ============================================================
// Yene Verify — Analytics Service (Step 18)
//
// Compose-on-demand read model: builds the query window, fans it
// out to repository aggregations, then projects JSON-safe DTOs.
// Pure business rules (recommendations, anomalies, trend math)
// live in insights/ and are unit-tested in isolation. No writes,
// no cache — analytics_snapshots stays optional for a later step.
// ============================================================

import { Injectable } from '@nestjs/common';
import { AnalyticsRepository } from './analytics.repository';
import {
  resolveAnalyticsRange,
  type AnalyticsRange,
  type AnalyticsRangeQuery,
} from './dto/analytics-range.query';
import type {
  AnalyticsAnomaliesResponseDto,
  AnalyticsBestDaysResponseDto,
  AnalyticsBestMonthsResponseDto,
  AnalyticsBestProductsResponseDto,
  AnalyticsPeakHoursResponseDto,
  AnalyticsSummaryResponseDto,
  AnalyticsTrendResponseDto,
  AnalyticsRecommendationsResponseDto,
  AnomalyItemDto,
  BestProductItemDto,
  RecommendationDto,
} from './dto/analytics-response.dto';
import { toRangeDto } from './dto/analytics-response.dto';
import { generateRecommendations } from './insights/rules-engine';
import type { RuleInputs } from './insights/recommendations';

/** Anomaly detector: |z| >= 2.5 on daily amounts, needs >= 7 observations. */
const ANOMALY_Z_THRESHOLD = 2.5;
const ANOMALY_MIN_DAYS = 7;
/** Trend "flat" band: |percent delta| below this is direction 'flat'. */
const TREND_FLAT_PCT = 5;

const MODEL = 'rules-v1' as const;

function bigAmount(v: bigint | undefined | null): string {
  return (v ?? 0n).toString();
}

/**
 * BigInt average with round-half-up — avoids float drift on money.
 * count === 0 → '0'.
 */
function bigAvg(sum: bigint, count: number): string {
  if (count <= 0) return '0';
  return ((sum + BigInt(Math.floor(count / 2))) / BigInt(count)).toString();
}

function pct(current: bigint, previous: bigint): number | null {
  if (previous === 0n) return null;
  return Number(((current - previous) * 10000n) / previous) / 100;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly repo: AnalyticsRepository) {}

  private window(merchantId: string, range: AnalyticsRange) {
    return { merchantId, from: range.from, to: range.to };
  }

  // ── 1. summary ──────────────────────────────────────────────────────────

  async summary(
    merchantId: string,
    query: AnalyticsRangeQuery,
  ): Promise<AnalyticsSummaryResponseDto> {
    const range = resolveAnalyticsRange(query);
    const row = await this.repo.findSummary(this.window(merchantId, range));

    return {
      range: toRangeDto(range),
      totals: {
        count: row.count,
        amountMinor: bigAmount(row.amountSum),
        avgAmountMinor: bigAvg(row.amountSum, row.count),
        uniqueSenders: row.uniqueSenders,
        uniqueSubMerchants: row.uniqueSubMerchants,
      },
      model: MODEL,
      generatedAt: new Date().toISOString(),
    };
  }

  // ── 2. best products ────────────────────────────────────────────────────

  async bestProducts(
    merchantId: string,
    query: AnalyticsRangeQuery,
  ): Promise<AnalyticsBestProductsResponseDto> {
    const range = resolveAnalyticsRange(query);
    const win = this.window(merchantId, range);

    // The share denominator is the same period's total verified amount —
    // which includes unlabelled product rows. Both queries read the same
    // narrow window so the two index scans stay cheap.
    const [items, summaryRow] = await Promise.all([
      this.repo.findBestProducts(win, 10),
      this.repo.findSummary(win),
    ]);

    const total = summaryRow.amountSum;
    const products: BestProductItemDto[] = items.map((it) => ({
      label: it.label,
      count: it.count,
      amountMinor: bigAmount(it.amountSum),
      share: total === 0n ? 0 : Number((it.amountSum * 10000n) / total) / 100,
    }));

    return {
      range: toRangeDto(range),
      items: products,
      model: MODEL,
      generatedAt: new Date().toISOString(),
    };
  }

  // ── 3. peak hours ───────────────────────────────────────────────────────

  async peakHours(
    merchantId: string,
    query: AnalyticsRangeQuery,
  ): Promise<AnalyticsPeakHoursResponseDto> {
    const range = resolveAnalyticsRange(query);
    const rows = await this.repo.findPeakHours(this.window(merchantId, range));

    const buckets = new Map<number, { count: number; amountSum: bigint }>();
    for (const r of rows) buckets.set(r.hour, { count: r.count, amountSum: r.amountSum });

    // ALWAYS 24 buckets — zeros where no transactions happened.
    const hours = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      count: buckets.get(h)?.count ?? 0,
      amountMinor: bigAmount(buckets.get(h)?.amountSum ?? 0n),
    }));

    const topHour = hours.reduce(
      (best, cur) =>
        (buckets.get(cur.hour)?.count ?? 0) > (buckets.get(best)?.count ?? 0) ? cur.hour : best,
      0,
    );

    return {
      range: toRangeDto(range),
      hours,
      topHour,
      model: MODEL,
      generatedAt: new Date().toISOString(),
    };
  }

  // ── 4. best days ────────────────────────────────────────────────────────

  async bestDays(
    merchantId: string,
    query: AnalyticsRangeQuery,
  ): Promise<AnalyticsBestDaysResponseDto> {
    const range = resolveAnalyticsRange(query);
    const rows = await this.repo.findBestDays(this.window(merchantId, range));

    const buckets = new Map<number, { count: number; amountSum: bigint }>();
    for (const r of rows) buckets.set(r.dayOfWeek, { count: r.count, amountSum: r.amountSum });

    // Always 7 buckets, Mon(1)..Sun(7); a zero-count day shows topDay 1
    // only when nothing else exists (all-zero → 1).
    const days = Array.from({ length: 7 }, (_, i) => {
      const dow = i + 1;
      return {
        dayOfWeek: dow,
        count: buckets.get(dow)?.count ?? 0,
        amountMinor: bigAmount(buckets.get(dow)?.amountSum ?? 0n),
      };
    });

    let topDay = 1;
    let topCount = -1;
    for (const d of days) {
      const c = buckets.get(d.dayOfWeek)?.count ?? 0;
      if (c > topCount) {
        topCount = c;
        topDay = d.dayOfWeek;
      }
    }

    return {
      range: toRangeDto(range),
      days,
      topDay,
      model: MODEL,
      generatedAt: new Date().toISOString(),
    };
  }

  // ── 5. best months ──────────────────────────────────────────────────────

  async bestMonths(
    merchantId: string,
    query: AnalyticsRangeQuery,
  ): Promise<AnalyticsBestMonthsResponseDto> {
    const range = resolveAnalyticsRange(query);
    const rows = await this.repo.findBestMonths(this.window(merchantId, range));

    const months = rows.map((r) => ({
      yearMonth: r.yearMonth,
      count: r.count,
      amountMinor: bigAmount(r.amountSum),
    }));

    let topMonth: string | null = null;
    let topCount = -1;
    for (const m of rows) {
      if (m.count > topCount) {
        topCount = m.count;
        topMonth = m.yearMonth;
      }
    }

    return {
      range: toRangeDto(range),
      months,
      topMonth,
      model: MODEL,
      generatedAt: new Date().toISOString(),
    };
  }

  // ── 6. trend ────────────────────────────────────────────────────────────

  async trend(merchantId: string, query: AnalyticsRangeQuery): Promise<AnalyticsTrendResponseDto> {
    const range = resolveAnalyticsRange(query);
    const durMs = range.to.getTime() - range.from.getTime();
    const previousRange: AnalyticsRange = {
      from: new Date(range.from.getTime() - durMs),
      to: range.from,
      days: range.days,
    };
    // Previous window is [prevFrom, prevTo) — the current `from` moment is
    // the boundary; shift `to` back 1ms so a paid_at exactly at `from`
    // never counts in both windows.
    const [current, previous] = await Promise.all([
      this.repo.findSummary(this.window(merchantId, range)),
      this.repo.findSummary({
        merchantId,
        from: previousRange.from,
        to: new Date(range.from.getTime() - 1),
      }),
    ]);

    const currentAmount = current.amountSum;
    const previousAmount = previous.amountSum;
    const countPct =
      previous.count === 0 ? null : ((current.count - previous.count) / previous.count) * 100;
    const amountPct = pct(currentAmount, previousAmount);

    let direction: 'up' | 'down' | 'flat';
    if (amountPct == null) {
      direction = 'flat';
    } else if (Math.abs(amountPct) < TREND_FLAT_PCT) {
      direction = 'flat';
    } else {
      direction = amountPct > 0 ? 'up' : 'down';
    }

    return {
      range: toRangeDto(range),
      current: { count: current.count, amountMinor: bigAmount(currentAmount) },
      previous: { count: previous.count, amountMinor: bigAmount(previousAmount) },
      delta: { countPct, amountPct },
      direction,
      model: MODEL,
      generatedAt: new Date().toISOString(),
    };
  }

  // ── 7. anomalies ────────────────────────────────────────────────────────

  async anomalies(
    merchantId: string,
    query: AnalyticsRangeQuery,
  ): Promise<AnalyticsAnomaliesResponseDto> {
    const range = resolveAnalyticsRange(query);
    const rows = await this.repo.findDailyVolumes(this.window(merchantId, range));

    const anomalies = detectAnomalies(rows);
    return {
      range: toRangeDto(range),
      anomalies,
      model: MODEL,
      generatedAt: new Date().toISOString(),
    };
  }

  // ── 8. recommendations ──────────────────────────────────────────────────

  async recommendations(
    merchantId: string,
    query: AnalyticsRangeQuery,
  ): Promise<AnalyticsRecommendationsResponseDto> {
    const range = resolveAnalyticsRange(query);
    const win = this.window(merchantId, range);

    // Reuse the 7 endpoint computations as rule inputs — same window, no
    // caching, 6 SQL round-trips total.
    const [summaryRow, peakRows, dayRows, summaryNow, summaryPrev, dailyRows] = await Promise.all([
      this.repo.findSummary(win),
      this.repo.findPeakHours(win),
      this.repo.findBestDays(win),
      this.repo.findSummary(win),
      this.repo.findSummary({
        merchantId,
        from: new Date(range.from.getTime() - (range.to.getTime() - range.from.getTime())),
        to: new Date(range.from.getTime() - 1),
      }),
      this.repo.findDailyVolumes(win),
    ]);

    const amountPct = pct(summaryNow.amountSum, summaryPrev.amountSum);
    const direction: 'flat' | 'up' | 'down' =
      amountPct == null || Math.abs(amountPct) < TREND_FLAT_PCT
        ? 'flat'
        : amountPct > 0
          ? 'up'
          : 'down';

    const peakHours = Array.from({ length: 24 }, (_, h) => {
      const row = peakRows.find((r) => r.hour === h);
      return { hour: h, count: row?.count ?? 0, amountMinor: row?.amountSum ?? 0n };
    });
    const bestDays = Array.from({ length: 7 }, (_, i) => {
      const dow = i + 1;
      const row = dayRows.find((r) => r.dayOfWeek === dow);
      return { dayOfWeek: dow, count: row?.count ?? 0 };
    });

    const now = new Date();
    const sevenDaysAgoIso = new Date(now.getTime() - 7 * 86_400_000).toISOString().slice(0, 10);
    const inputs: RuleInputs = {
      summary: {
        count: summaryRow.count,
        amountMinor: summaryRow.amountSum,
        uniqueSenders: summaryRow.uniqueSenders,
        uniqueSubMerchants: summaryRow.uniqueSubMerchants,
        nullProductLabelCount: summaryRow.nullProductLabelCount,
      },
      peakHours,
      bestDays,
      trend: { direction, amountPct },
      anomalies: detectAnomalies(dailyRows).map((a) => ({
        ...a,
        withinLast7Days: a.date >= sevenDaysAgoIso,
      })),
    };
    const recs: RecommendationDto[] = generateRecommendations(inputs);

    return {
      range: toRangeDto(range),
      recommendations: recs,
      model: MODEL,
      generatedAt: now.toISOString(),
    };
  }
}

/**
 * Z-score anomaly detection on the daily amount series.
 * Population standard deviation; σ === 0 (flat volumes) → no anomalies;
 * fewer than ANOMALY_MIN_DAYS calendar days in range → no anomalies.
 * Zero-count days ARE part of the series (so a lone spike among empty
 * days still detects), matching "daily volume" semantics.
 */
export function detectAnomalies(
  rows: Array<{ date: string; count: number; amountSum: bigint }>,
  opts: {
    minDays?: number;
    zThreshold?: number;
    rangeStart?: Date;
    rangeEnd?: Date;
  } = {},
): AnomalyItemDto[] {
  const minDays = opts.minDays ?? ANOMALY_MIN_DAYS;
  const zThreshold = opts.zThreshold ?? ANOMALY_Z_THRESHOLD;

  if (opts.rangeStart && opts.rangeEnd) {
    // Validate the observed day count against the requested span when the
    // caller supplies it (service path). The pure series length is used
    // as fallback so the function stays usable from unit specs.
    const spanDays = Math.floor((opts.rangeEnd.getTime() - opts.rangeStart.getTime()) / 86_400_000);
    if (spanDays + 1 < minDays) return [];
  }

  const amounts = rows.map((r) => r.amountSum);
  if (amounts.length < minDays) return [];

  const n = BigInt(amounts.length);
  const mean = amounts.reduce((a, b) => a + b, 0n) / n;
  const variance =
    amounts.reduce((acc, v) => {
      const d = v - mean;
      return acc + d * d;
    }, 0n) / n;
  // Bigint variance projected to Number for the sqrt — verified amounts
  // stay far below 2^53 at these scales, no precision loss in practice.
  const sigma = Math.sqrt(Number(variance));
  if (sigma === 0) return [];

  const out: AnomalyItemDto[] = [];
  for (const row of rows) {
    const z = (Number(row.amountSum) - Number(mean)) / sigma;
    if (Math.abs(z) < zThreshold) continue;
    out.push({
      date: row.date,
      count: row.count,
      amountMinor: row.amountSum.toString(),
      zScore: Number(z.toFixed(2)),
      direction: z > 0 ? 'spike' : 'drop',
    });
  }
  return out;
}
