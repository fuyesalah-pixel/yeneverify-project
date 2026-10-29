// ============================================================
// Yene Verify — Analytics range query (Step 18)
//
// Common `from`/`to` accepted by every /analytics endpoint.
// Defaults: last 30 days; max range 365 days. Pure Zod parsing;
// the range resolution lives in resolveAnalyticsRange() so the
// service can unit-test the boundary rules without HTTP.
// ============================================================

import { z } from 'zod';
import { ValidationError } from '../../common/errors/domain-errors';

export const AnalyticsRangeQuerySchema = z
  .object({
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional(),
  })
  .strict();

export type AnalyticsRangeQuery = z.infer<typeof AnalyticsRangeQuerySchema>;

const DEFAULT_RANGE_DAYS = 30;
const MAX_RANGE_DAYS = 365;
const DAY_MS = 86_400_000;

export interface AnalyticsRange {
  from: Date;
  to: Date;
  /** Inclusive calendar-day span (ceil). */
  days: number;
}

/**
 * Shared range resolution for all analytics endpoints:
 *   - both missing        → last 30 days
 *   - only `from`         → from .. from+30d
 *   - only `to`           → to-30d .. to
 *   - span > 365 days     → ValidationError (400 VALIDATION_FAILED)
 *
 * `to` is inclusive-right: the repo compares `paid_at <= to` so the
 * caller's chosen end-day is part of the window.
 */
export function resolveAnalyticsRange(
  query: AnalyticsRangeQuery,
  now: Date = new Date(),
): AnalyticsRange {
  let from: Date;
  let to: Date;

  if (query.from && query.to) {
    from = new Date(query.from);
    to = new Date(query.to);
  } else if (query.from) {
    from = new Date(query.from);
    to = new Date(from.getTime() + DEFAULT_RANGE_DAYS * DAY_MS);
  } else if (query.to) {
    to = new Date(query.to);
    from = new Date(to.getTime() - DEFAULT_RANGE_DAYS * DAY_MS);
  } else {
    to = new Date(now.getTime());
    from = new Date(to.getTime() - DEFAULT_RANGE_DAYS * DAY_MS);
  }

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new ValidationError('Invalid from/to date', {});
  }

  const days = Math.ceil((to.getTime() - from.getTime()) / DAY_MS);
  if (days > MAX_RANGE_DAYS) {
    throw new ValidationError('Range too large: maximum 365 days', {});
  }

  return { from, to, days: Math.max(1, days) };
}
