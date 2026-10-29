// ============================================================
// Yene Verify — Analytics response DTOs (Step 18)
//
// All JSON-safe: bigint amounts as strings, dates ISO, never a raw
// transaction row. Every response carries model:'rules-v1' so a
// future ML engine can swap shapes under a new model tag.
// ============================================================

import type { AnalyticsRange } from './analytics-range.query';

export interface RangeDto {
  from: string; // ISO
  to: string; // ISO
  days: number;
}

export interface SummaryTotalsDto {
  count: number;
  /** Sum of verified amounts, bigint as string. */
  amountMinor: string;
  /** Mean per transaction, bigint-rounded, as string. */
  avgAmountMinor: string;
  uniqueSenders: number;
  uniqueSubMerchants: number;
}

/** GET /analytics/summary → 200 */
export interface AnalyticsSummaryResponseDto {
  range: RangeDto;
  totals: SummaryTotalsDto;
  model: 'rules-v1';
  generatedAt: string;
}

export interface BestProductItemDto {
  label: string;
  count: number;
  amountMinor: string;
  /** Share 0..1 of the total verified amount in range. */
  share: number;
}

/** GET /analytics/best-products → 200 (top 10 by amount DESC) */
export interface AnalyticsBestProductsResponseDto {
  range: RangeDto;
  items: BestProductItemDto[];
  model: 'rules-v1';
  generatedAt: string;
}

export interface PeakHourBucketDto {
  hour: number; // 0..23, Africa/Addis_Ababa
  count: number;
  amountMinor: string;
}

/** GET /analytics/peak-hours → 200 (always 24 buckets) */
export interface AnalyticsPeakHoursResponseDto {
  range: RangeDto;
  hours: PeakHourBucketDto[];
  topHour: number;
  model: 'rules-v1';
  generatedAt: string;
}

export interface BestDayBucketDto {
  dayOfWeek: number; // 1=Mon .. 7=Sun (ISO)
  count: number;
  amountMinor: string;
}

/** GET /analytics/best-days → 200 (always 7 buckets, Mon..Sun) */
export interface AnalyticsBestDaysResponseDto {
  range: RangeDto;
  days: BestDayBucketDto[];
  topDay: number;
  model: 'rules-v1';
  generatedAt: string;
}

export interface BestMonthBucketDto {
  yearMonth: string; // 'YYYY-MM'
  count: number;
  amountMinor: string;
}

/** GET /analytics/best-months → 200 (only months touched by the range) */
export interface AnalyticsBestMonthsResponseDto {
  range: RangeDto;
  months: BestMonthBucketDto[];
  topMonth: string | null;
  model: 'rules-v1';
  generatedAt: string;
}

export interface TrendPeriodDto {
  count: number;
  amountMinor: string;
}

export interface TrendDeltaDto {
  countPct: number | null; // null when previous.count === 0
  amountPct: number | null;
}

/** GET /analytics/trend → 200 */
export interface AnalyticsTrendResponseDto {
  range: RangeDto;
  current: TrendPeriodDto;
  previous: TrendPeriodDto;
  delta: TrendDeltaDto;
  direction: 'up' | 'down' | 'flat'; // flat when |amountPct| < 5
  model: 'rules-v1';
  generatedAt: string;
}

export interface AnomalyItemDto {
  date: string; // 'YYYY-MM-DD' in Africa/Addis_Ababa
  count: number;
  amountMinor: string;
  zScore: number;
  direction: 'spike' | 'drop';
}

/** GET /analytics/anomalies → 200 (empty until >= 7 days of data) */
export interface AnalyticsAnomaliesResponseDto {
  range: RangeDto;
  anomalies: AnomalyItemDto[];
  model: 'rules-v1';
  generatedAt: string;
}

export type RecommendationSeverity = 'info' | 'opportunity' | 'warning';

export interface RecommendationDto {
  id: string;
  severity: RecommendationSeverity;
  title: string;
  body: string;
}

/** GET /analytics/recommendations → 200 (0-5 items) */
export interface AnalyticsRecommendationsResponseDto {
  range: RangeDto;
  recommendations: RecommendationDto[];
  model: 'rules-v1';
  generatedAt: string;
}

/** range → RangeDto mapper shared by all endpoints. */
export function toRangeDto(range: AnalyticsRange): RangeDto {
  return {
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    days: range.days,
  };
}
