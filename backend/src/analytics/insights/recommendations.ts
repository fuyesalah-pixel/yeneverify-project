// ============================================================
// Yene Verify — Recommendation rules (Step 18)
//
// Each rule is a small pure function over already-computed
// aggregates; it returns a Recommendation or null. The rules engine
// (rules-engine.ts) runs all of them and assembles the list.
// No I/O anywhere in this file.
// ============================================================

import type { RecommendationDto, RecommendationSeverity } from '../dto/analytics-response.dto';

export interface RuleInputs {
  /** GET /analytics/summary totals, plus the null-product share. */
  summary: {
    count: number;
    amountMinor: bigint;
    uniqueSenders: number;
    uniqueSubMerchants: number;
    nullProductLabelCount: number;
  };
  /** 24 buckets (0..23 Addis time), always present. */
  peakHours: Array<{ hour: number; count: number; amountMinor: bigint }>;
  /** Day-of-week buckets, 1..7. */
  bestDays: Array<{ dayOfWeek: number; count: number }>;
  trend: {
    direction: 'up' | 'down' | 'flat';
    amountPct: number | null;
  };
  anomalies: Array<{
    date: string;
    direction: 'spike' | 'drop';
    /** True when the anomalous day falls in the most recent 7 days. */
    withinLast7Days: boolean;
  }>;
}

/** Top-hour cluster rule: one 3-hour window holding >= 40% of volume. */
export function topHourClusterRule(inputs: RuleInputs): RecommendationDto | null {
  const { peakHours, summary } = inputs;
  if (summary.count === 0) return null;

  let bestStart = 0;
  let bestWindowCount = -1;
  for (let start = 0; start < 24; start++) {
    // 3-hour sliding window, wrapping midnight (22,23,0 / 23,0,1 …)
    let windowCount = 0;
    for (let h = start; h < start + 3; h++) {
      windowCount += peakHours[h % 24]?.count ?? 0;
    }
    if (windowCount > bestWindowCount) {
      bestWindowCount = windowCount;
      bestStart = start;
    }
  }

  const share = bestWindowCount / summary.count;
  if (share < 0.4) return null;

  const hourLabel = (h: number) => {
    const normalized = ((h % 24) + 24) % 24;
    return normalized === 0
      ? '12 AM'
      : normalized === 12
        ? '12 PM'
        : normalized < 12
          ? `${normalized} AM`
          : `${normalized - 12} PM`;
  };

  return {
    id: 'peak-hour-cluster',
    severity: 'opportunity',
    title: 'Concentrated peak sales window',
    body: `About ${Math.round(share * 100)}% of your verified sales cluster between ${hourLabel(bestStart)} and ${hourLabel(bestStart + 3)} (Addis time). Consider stocking up and staffing for that window.`,
  };
}

/** Weekend rule: per-day weekend rate >= 1.5× the per-day weekday rate. */
export function weekendDominanceRule(inputs: RuleInputs): RecommendationDto | null {
  const { bestDays, summary } = inputs;
  if (summary.count === 0) return null;

  const countOn = (dow: number) => bestDays.find((d) => d.dayOfWeek === dow)?.count ?? 0;
  const weekendCount = countOn(6) + countOn(7); // Sat + Sun (ISO dow)
  const weekdayCount = summary.count - weekendCount;

  // 2 weekend days vs 5 weekdays in a standard week.
  const weekendPerDay = weekendCount / 2;
  const weekdayPerDay = weekdayCount / 5;

  if (weekdayCount === 0) {
    return weekendCount > 0
      ? {
          id: 'weekend-heavy',
          severity: 'info',
          title: 'Weekend-only sales so far',
          body: 'All your verified sales happened on weekends. Keep an eye on weekdays as volume grows.',
        }
      : null;
  }

  const ratio = weekendPerDay / weekdayPerDay;
  if (ratio < 1.5) return null;

  return {
    id: 'weekend-heavy',
    severity: 'info',
    title: 'Weekend-heavy business',
    body: 'Weekends draw considerably more sales than weekdays relative to their share of the week. Consider staffing up Fri–Sun.',
  };
}

/** Downward trend rule: direction 'down' with amountPct <= -15%. */
export function downwardTrendRule(inputs: RuleInputs): RecommendationDto | null {
  const { trend } = inputs;
  if (trend.direction !== 'down') return null;
  if (trend.amountPct == null || trend.amountPct > -15) return null;

  return {
    id: 'trend-down',
    severity: 'warning',
    title: 'Sales trending down',
    body: `Verified sales dropped about ${Math.abs(Math.round(trend.amountPct))}% versus the previous period. Review your best products or consider a promo.`,
  };
}

/** Data-hygiene rule: >= 30% of transactions lack product_label. */
export function missingProductLabelRule(inputs: RuleInputs): RecommendationDto | null {
  const { summary } = inputs;
  if (summary.count === 0) return null;
  const pct = summary.nullProductLabelCount / summary.count;
  if (pct < 0.3) return null;

  return {
    id: 'tag-products',
    severity: 'info',
    title: 'Tag your transactions with product names',
    body: `${Math.round(pct * 100)}% of your verified transactions have no product label. Tagging them unlocks detailed product analytics and best-seller insights.`,
  };
}

/** Anomaly rule: at least one spike inside the last 7 days. */
export function recentSpikeRule(inputs: RuleInputs): RecommendationDto | null {
  const spike = inputs.anomalies.find((a) => a.direction === 'spike' && a.withinLast7Days);
  if (!spike) return null;

  return {
    id: 'recent-spike',
    severity: 'opportunity',
    title: 'Unusual spike detected',
    body: `Sales spiked unusually on ${spike.date} — worth investigating what drove it, and whether it can be repeated.`,
  };
}

/** Single-operator rule: > 100 transactions, activity from exactly one teammate. */
export function singleOperatorRule(inputs: RuleInputs): RecommendationDto | null {
  const { summary } = inputs;
  if (summary.count <= 100) return null;
  if (summary.uniqueSubMerchants !== 1) return null;

  return {
    id: 'single-operator',
    severity: 'info',
    title: 'All activity from one team member',
    body: 'More than 100 verifications, all from a single account. Adding teammates (sub-merchants) spreads the workload and de-risks your verification history.',
  };
}

/** The full rule set, in stable emission order. */
export const RECOMMENDATION_RULES: Array<(inputs: RuleInputs) => RecommendationDto | null> = [
  topHourClusterRule,
  weekendDominanceRule,
  downwardTrendRule,
  missingProductLabelRule,
  recentSpikeRule,
  singleOperatorRule,
];

export type { RecommendationSeverity };
