// ============================================================
// Yene Verify — Analytics Repository (Step 18)
//
// Aggregations only — never raw transaction rows. All queries are
// merchant-scoped (merchant_id = $1), status VERIFIED, paid_at in a
// half-open-tolerant [from, to] window, and served by the existing
// transactions indexes (merchant_id, paid_at) / (merchant_id, status).
// Time bucketing is done in Africa/Addis_Ababa via AT TIME ZONE.
//
// Prisma $queryRaw maps BIGINT → JS bigint, so all amount math
// happens on bigint and the conversion to string happens in the
// DTO layer only.
// ============================================================

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AnalyticsWindow {
  merchantId: string;
  from: Date;
  to: Date;
}

export interface SummaryRow {
  count: number;
  amountSum: bigint;
  uniqueSenders: number;
  uniqueSubMerchants: number;
  nullProductLabelCount: number;
}

export interface LabelGroupRow {
  label: string;
  count: number;
  amountSum: bigint;
}

export interface HourBucketRow {
  hour: number;
  count: number;
  amountSum: bigint;
}

export interface DayBucketRow {
  dayOfWeek: number; // 1=Mon .. 7=Sun (ISODOW)
  count: number;
  amountSum: bigint;
}

export interface MonthBucketRow {
  yearMonth: string; // 'YYYY-MM'
  count: number;
  amountSum: bigint;
}

export interface DailyVolumeRow {
  date: string; // 'YYYY-MM-DD' (Addis local day)
  count: number;
  amountSum: bigint;
}

@Injectable()
export class AnalyticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findSummary(window: AnalyticsWindow): Promise<SummaryRow> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        cnt: bigint;
        amount_sum: bigint | null;
        unique_senders: bigint | null;
        unique_sub_merchants: bigint | null;
        null_product_count: bigint;
      }>
    >`
      -- Postgres SUM(bigint) yields numeric → Prisma maps it to Decimal;
      -- cast back to int8 so every amount here is a JS bigint at runtime.
      SELECT
        COUNT(*)                                                                                     AS cnt,
        COALESCE(SUM(amount_minor), 0)::bigint                                                       AS amount_sum,
        COUNT(DISTINCT sender_name)                                                                  AS unique_senders,
        COUNT(DISTINCT sub_merchant_id)                                                              AS unique_sub_merchants,
        COUNT(*) FILTER (WHERE product_label IS NULL)                                                AS null_product_count
      FROM transactions
      WHERE merchant_id = ${window.merchantId}::uuid
        AND status = 'VERIFIED'
        AND paid_at >= ${window.from}
        AND paid_at <= ${window.to}`;
    const r = rows[0];
    return {
      count: Number(r?.cnt ?? 0),
      amountSum: r?.amount_sum ?? 0n,
      uniqueSenders: Number(r?.unique_senders ?? 0),
      uniqueSubMerchants: Number(r?.unique_sub_merchants ?? 0),
      nullProductLabelCount: Number(r?.null_product_count ?? 0),
    };
  }

  /** Top products by verified amount. Rows with NULL product_label are excluded (MVP). */
  async findBestProducts(window: AnalyticsWindow, limit: number): Promise<LabelGroupRow[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{ label: string; cnt: bigint; amount_sum: bigint }>
    >`
      SELECT
        product_label AS label,
        COUNT(*)      AS cnt,
        SUM(amount_minor)::bigint AS amount_sum
      FROM transactions
      WHERE merchant_id = ${window.merchantId}::uuid
        AND status = 'VERIFIED'
        AND paid_at >= ${window.from}
        AND paid_at <= ${window.to}
        AND product_label IS NOT NULL
        AND product_label <> ''
      GROUP BY product_label
      ORDER BY amount_sum DESC, cnt DESC
      LIMIT ${limit}`;
    return rows.map((r) => ({ label: r.label, count: Number(r.cnt), amountSum: r.amount_sum }));
  }

  async findPeakHours(window: AnalyticsWindow): Promise<HourBucketRow[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{ hour: bigint; cnt: bigint; amount_sum: bigint }>
    >`
      SELECT
        EXTRACT(HOUR FROM (paid_at AT TIME ZONE 'Africa/Addis_Ababa'))::int AS hour,
        COUNT(*)                                                           AS cnt,
        SUM(amount_minor)::bigint                                          AS amount_sum
      FROM transactions
      WHERE merchant_id = ${window.merchantId}::uuid
        AND status = 'VERIFIED'
        AND paid_at >= ${window.from}
        AND paid_at <= ${window.to}
      GROUP BY 1
      ORDER BY 1`;
    return rows.map((r) => ({
      hour: Number(r.hour),
      count: Number(r.cnt),
      amountSum: r.amount_sum,
    }));
  }

  async findBestDays(window: AnalyticsWindow): Promise<DayBucketRow[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{ day_of_week: bigint; cnt: bigint; amount_sum: bigint }>
    >`
      SELECT
        EXTRACT(ISODOW FROM (paid_at AT TIME ZONE 'Africa/Addis_Ababa'))::int AS day_of_week,
        COUNT(*)                                                             AS cnt,
        SUM(amount_minor)::bigint                                            AS amount_sum
      FROM transactions
      WHERE merchant_id = ${window.merchantId}::uuid
        AND status = 'VERIFIED'
        AND paid_at >= ${window.from}
        AND paid_at <= ${window.to}
      GROUP BY 1
      ORDER BY 1`;
    return rows.map((r) => ({
      dayOfWeek: Number(r.day_of_week),
      count: Number(r.cnt),
      amountSum: r.amount_sum,
    }));
  }

  async findBestMonths(window: AnalyticsWindow): Promise<MonthBucketRow[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{ ym: string; cnt: bigint; amount_sum: bigint }>
    >`
      SELECT
        TO_CHAR(paid_at AT TIME ZONE 'Africa/Addis_Ababa', 'YYYY-MM') AS ym,
        COUNT(*)                                                      AS cnt,
        SUM(amount_minor)::bigint                                     AS amount_sum
      FROM transactions
      WHERE merchant_id = ${window.merchantId}::uuid
        AND status = 'VERIFIED'
        AND paid_at >= ${window.from}
        AND paid_at <= ${window.to}
      GROUP BY 1
      ORDER BY 1`;
    return rows.map((r) => ({ yearMonth: r.ym, count: Number(r.cnt), amountSum: r.amount_sum }));
  }

  /** Daily volume in Addis local days — the anomaly detector's input. */
  async findDailyVolumes(window: AnalyticsWindow): Promise<DailyVolumeRow[]> {
    const rows = await this.prisma.$queryRaw<Array<{ d: string; cnt: bigint; amount_sum: bigint }>>`
      SELECT
        TO_CHAR(paid_at AT TIME ZONE 'Africa/Addis_Ababa', 'YYYY-MM-DD') AS d,
        COUNT(*)                                                         AS cnt,
        SUM(amount_minor)::bigint                                        AS amount_sum
      FROM transactions
      WHERE merchant_id = ${window.merchantId}::uuid
        AND status = 'VERIFIED'
        AND paid_at >= ${window.from}
        AND paid_at <= ${window.to}
      GROUP BY 1
      ORDER BY 1`;
    return rows.map((r) => ({ date: r.d, count: Number(r.cnt), amountSum: r.amount_sum }));
  }
}
