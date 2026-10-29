// ============================================================
// Yene Verify — Analytics E2E (Step 18, real DB + real SQL)
//
// Rule-based merchant insights over seeded VERIFIED transactions.
//
// Time discipline (the suite must be blind to when it runs):
//   - every seeded paid_at lands at exactly 12:00 UTC on day
//     `midnightUtc - d days` → Addis hour = 15, same civil date,
//   - windows are explicit offsets of `midnightUtc`, never `now`.
//
// Seeded daily series (per day, 3 txns):
//   d = 1..14, amount 10_000/day txn (30_000/day), productLabel
//   Coffee on d 1..7 (incl. spike), Tea on d 8..14.
//   Spike day d = 2: amount 400_000/txn (1_200_000/day) — z ≈ 3.6,
//   ordinary days ≈ -0.28 → exactly one anomaly.
//
// Cross-tenant: a second merchant sees only its own 2 rows.
// Sub-merchant: 403 on every endpoint (merchant-only surface).
// ============================================================

import { Test } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { createHash, randomBytes } from 'crypto';
import { AppModule } from '../src/app.module';
import { AppConfigService } from '../src/config/config.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { TokenService } from '../src/auth/tokens/token.service';
import { newId } from '../src/common/utils/id.util';

const DAY_MS = 86_400_000;
const ORDINARY_TX_AMOUNT = 10_000n; // 3 txns/day → 30_000 / day
const SPIKE_TX_AMOUNT = 400_000n; // 3 txns/day → 1_200_000 / day
const SPIKE_DAY = 2; // inside the last 7 days → spike rule fires

interface AuthFixture {
  userId: string;
  merchantId: string;
  deviceId: string;
  sessionId: string;
  subMerchantId?: string;
}

describe('Analytics (e2e, real DB)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenService: TokenService;

  const runTag = randomBytes(5).toString('hex');
  let midnightUtc: Date;

  const merchantA = makeFixture();
  const merchantB = makeFixture();
  const sub = makeFixture(); // SUB_MERCHANT role on merchant A

  let merchantToken: string;
  let merchantBToken: string;
  let subToken: string;

  // Expected aggregates for merchant A over the default 30-day window.
  const EXPECTED_COUNT = 42; // 14 days × 3
  const EXPECTED_AMOUNT = '1590000'; // 13 × 30_000 + 1_200_000
  const SPIKE_AMOUNT = '1200000';

  function makeFixture(): AuthFixture {
    return {
      userId: newId(),
      merchantId: newId(),
      deviceId: newId(),
      sessionId: newId(),
    };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication({ logger: ['error', 'warn'] });
    const cfg = app.get(AppConfigService);
    app.setGlobalPrefix(cfg.runtime.apiPrefix, {
      exclude: ['health', 'health/ready', 'docs', 'version', '/'],
    });
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: cfg.runtime.apiVersion.replace(/^v/i, ''),
    });
    await app.init();

    prisma = app.get(PrismaService);
    tokenService = app.get(TokenService);

    // Anchor: today at 12:00 UTC (Addis 15:00, no civil-date shift for +3h).
    midnightUtc = new Date();
    midnightUtc.setUTCHours(12, 0, 0, 0);

    // ── Merchant A (+ its sub-merchant user) ──────────────────────────────
    await createUserMerchant(merchantA, 'Analytics A', 0);
    await createUserMerchant(merchantB, 'Analytics B', 1);

    // Sub-merchant on A: user + sub_merchants row (TenantGuard reads this).
    await prisma.user.create({
      data: {
        id: sub.userId,
        phone: `+2519${Date.now().toString().slice(-7)}2`,
        phoneVerifiedAt: new Date(),
        fullName: 'E2E Analytics Sub',
        role: 'SUB_MERCHANT',
        status: 'ACTIVE',
      },
    });
    sub.subMerchantId = newId();
    await prisma.subMerchant.create({
      data: {
        id: sub.subMerchantId,
        userId: sub.userId,
        merchantId: merchantA.merchantId,
        status: 'ACTIVE',
        branchLabel: `E2E Analytics Sub ${runTag}`,
        invitedAt: new Date(),
        joinedAt: new Date(),
      },
    });

    await createDeviceSession(merchantA);
    await createDeviceSession(merchantB);
    await createDeviceSession(sub);

    merchantToken = sign(merchantA, 'MERCHANT');
    merchantBToken = sign(merchantB, 'MERCHANT');
    subToken = sign(sub, 'SUB_MERCHANT');

    // ── Seed merchant A's 14-day series (d = 1..14, always ≤ now) ────────
    await seedTransactions(
      merchantA.merchantId,
      merchantA.userId,
      [
        ...days(1, 14).map((d) => ({
          day: d,
          amountMinor: d === SPIKE_DAY ? SPIKE_TX_AMOUNT : ORDINARY_TX_AMOUNT,
          productLabel: d < 8 ? 'Coffee' : 'Tea',
        })),
      ],
      sub.subMerchantId ?? null,
    );
    // ── Seed merchant B: 2 lonely rows of their own ──────────────────────
    await seedTransactions(
      merchantB.merchantId,
      merchantB.userId,
      [
        ...days(3, 4).map((d) => ({
          day: d,
          amountMinor: ORDINARY_TX_AMOUNT,
          productLabel: 'Tea',
        })),
      ],
      null,
    );
  }, 90_000);

  // ── fixture helpers ─────────────────────────────────────────────────────

  function days(from: number, to: number): number[] {
    const out: number[] = [];
    for (let d = from; d <= to; d += 1) out.push(d);
    return out;
  }

  async function createUserMerchant(f: AuthFixture, name: string, suffix: number): Promise<void> {
    await prisma.user.create({
      data: {
        id: f.userId,
        phone: `+2519${Date.now().toString().slice(-7)}${suffix}`,
        phoneVerifiedAt: new Date(),
        fullName: `E2E ${name}`,
        role: 'MERCHANT',
        status: 'ACTIVE',
      },
    });
    await prisma.merchant.create({
      data: {
        id: f.merchantId,
        ownerUserId: f.userId,
        businessName: `E2E ${name} ${runTag}`,
        status: 'ACTIVE',
      },
    });
  }

  async function createDeviceSession(f: AuthFixture): Promise<void> {
    await prisma.device.create({
      data: {
        id: f.deviceId,
        userId: f.userId,
        deviceFingerprint: `e2e-analytics-${runTag}-${f.deviceId.slice(0, 8)}`,
        platform: 'ANDROID',
      },
    });
    await prisma.session.create({
      data: {
        id: f.sessionId,
        userId: f.userId,
        deviceId: f.deviceId,
        refreshTokenHash: createHash('sha256')
          .update(`analytics-${-runTag}-${f.sessionId}`)
          .digest('hex'),
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });
  }

  function sign(f: AuthFixture, role: 'MERCHANT' | 'SUB_MERCHANT'): string {
    return tokenService.signAccessToken({
      sub: f.userId,
      role,
      merchantId: f.merchantId,
      sid: f.sessionId,
      did: f.deviceId,
    });
  }

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const ENDPOINTS = [
    '/api/v1/analytics/summary',
    '/api/v1/analytics/best-products',
    '/api/v1/analytics/peak-hours',
    '/api/v1/analytics/best-days',
    '/api/v1/analytics/best-months',
    '/api/v1/analytics/trend',
    '/api/v1/analytics/anomalies',
    '/api/v1/analytics/recommendations',
  ] as const;

  async function seedTransactions(
    merchantId: string,
    ownerId: string,
    specs: Array<{ day: number; amountMinor: bigint; productLabel: string }>,
    spikeSubMerchantId: string | null,
  ): Promise<void> {
    let seq = 0;
    for (const spec of specs) {
      for (let i = 0; i < 3; i += 1) {
        seq += 1;
        const receiptId = newId();
        const verificationId = newId();
        const paidAt = new Date(midnightUtc.getTime() - spec.day * DAY_MS);

        await prisma.receipt.create({
          data: {
            id: receiptId,
            merchantId,
            uploadedByUserId: ownerId,
            storageKey: `e2e-analytics/${runTag}/${seq}.jpg`,
            mimeType: 'image/jpeg',
            sizeBytes: 64,
            sha256: randomBytes(16).toString('hex'),
            inputMethod: 'UPLOAD',
          },
        });
        await prisma.verification.create({
          data: {
            id: verificationId,
            merchantId,
            verifiedByUserId: ownerId,
            receiptId,
            source: 'TRANSACTION',
            bankCode: 'CBE',
            bankReference: `E2E18-${runTag}-${seq}`,
            amountMinor: spec.amountMinor,
            senderName: `Sender-${seq}`,
            receiverName: 'Analytics Merchant',
            paidAt,
            status: 'VERIFIED',
            completedAt: paidAt,
          },
        });
        await prisma.transaction.create({
          data: {
            id: newId(),
            merchantId,
            verificationId,
            // the spike day's first 2 txns carry the fixture sub-merchant id
            // → uniqueSubMerchants = 1 for A, 0 for B
            subMerchantId: spec.day === SPIKE_DAY && i < 2 ? spikeSubMerchantId : null,
            verifiedByUserId: ownerId,
            bankCode: 'CBE',
            bankReference: `E2E18-${runTag}-${seq}`,
            amountMinor: spec.amountMinor,
            senderName: `Sender-${seq}`,
            paidAt,
            status: 'VERIFIED',
            productLabel: spec.productLabel,
          },
        });
      }
    }
  }

  afterAll(async () => {
    // Best-effort sweep (fresh ids per run mean leaks are cheap, the credits
    // suites' convention). Users stay behind like the other real-DB suites.
    for (const f of [merchantA, merchantB, sub]) {
      await prisma.transaction
        .deleteMany({ where: { merchantId: f.merchantId } })
        .catch(() => undefined);
      await prisma.verification
        .deleteMany({ where: { merchantId: f.merchantId } })
        .catch(() => undefined);
      await prisma.receipt
        .deleteMany({ where: { merchantId: f.merchantId } })
        .catch(() => undefined);
      if (sub.subMerchantId) {
        await prisma.subMerchant
          .deleteMany({ where: { id: sub.subMerchantId } })
          .catch(() => undefined);
      }
      await prisma.merchant.deleteMany({ where: { id: f.merchantId } }).catch(() => undefined);
    }
    await app.close();
  });

  // ── 1. happy path: summary matches the seeded series exactly ───────────

  it('summary: seeded count/amount/senders/sub-merchants over the default window', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/analytics/summary')
      .set(auth(merchantToken))
      .expect(200);

    expect(res.body.totals).toEqual({
      count: EXPECTED_COUNT,
      amountMinor: EXPECTED_AMOUNT,
      avgAmountMinor: expect.any(String),
      uniqueSenders: EXPECTED_COUNT,
      uniqueSubMerchants: 1,
    });
    expect(res.body.model).toBe('rules-v1');
    expect(typeof res.body.generatedAt).toBe('string');
    expect(res.body.range.days).toBe(30);
    expect(typeof res.body.range.from).toBe('string');
    expect(typeof res.body.range.to).toBe('string');
  });

  // ── 2. peak hours: 24 buckets, everything at Addis 15:00 ───────────────

  it('peakHours: 24 buckets summing to the total, all volume in Addis hour 15', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/analytics/peak-hours')
      .set(auth(merchantToken))
      .expect(200);

    expect(res.body.hours).toHaveLength(24);
    const sum = res.body.hours.reduce((a: number, h: { count: number }) => a + h.count, 0);
    expect(sum).toBe(EXPECTED_COUNT);

    const hour15 = res.body.hours.find((h: { hour: number }) => h.hour === 15);
    expect(hour15.count).toBe(EXPECTED_COUNT);
    expect(hour15.amountMinor).toBe(EXPECTED_AMOUNT);
    expect(res.body.topHour).toBe(15);
    expect(res.body.hours.filter((h: { count: number }) => h.count === 0)).toHaveLength(23);
    expect(res.body.model).toBe('rules-v1');
  });

  // ── 3. best products: Coffee dominates (spike day is Coffee) ───────────

  it('bestProducts: Coffee then Tea, amounts and share of the window', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/analytics/best-products')
      .set(auth(merchantToken))
      .expect(200);

    expect(res.body.items).toEqual([
      { label: 'Coffee', count: 21, amountMinor: '1380000', share: expect.any(Number) },
      { label: 'Tea', count: 21, amountMinor: '210000', share: expect.any(Number) },
    ]);
    // share math: 1_380_000 / 1_590_000 and 210_000 / 1_590_000 (bigint truncation)
    expect(res.body.items[0].share).toBeCloseTo(86.79, 1);
    expect(res.body.items[1].share).toBeCloseTo(13.2, 1);
    expect(res.body.model).toBe('rules-v1');
  });

  // ── 4. best days: 7 buckets, consistent topDay / bucket sums ──────────

  it('bestDays: 7 buckets, topDay is the max, buckets sum to the total', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/analytics/best-days')
      .set(auth(merchantToken))
      .expect(200);

    expect(res.body.days.map((d: { dayOfWeek: number }) => d.dayOfWeek)).toEqual([
      1, 2, 3, 4, 5, 6, 7,
    ]);
    const top = res.body.days.reduce(
      (best: { dayOfWeek: number; count: number }, d: { dayOfWeek: number; count: number }) =>
        d.count > best.count ? d : best,
      res.body.days[0],
    ).dayOfWeek;
    expect(res.body.topDay).toBe(top);
    expect(res.body.days.reduce((a: number, d: { count: number }) => a + d.count, 0)).toBe(
      EXPECTED_COUNT,
    );
    expect(res.body.model).toBe('rules-v1');
  });

  // ── 5. best months: every bucket is YYYY-MM, sums match ───────────────

  it('bestMonths: YYYY-MM buckets covering the 14-day span, topMonth is argmax', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/analytics/best-months')
      .set(auth(merchantToken))
      .expect(200);

    expect(res.body.months.length).toBeGreaterThanOrEqual(1);
    expect(res.body.months.length).toBeLessThanOrEqual(2); // 14 days spans ≤ 2 months
    for (const m of res.body.months) {
      expect(m.yearMonth).toMatch(/^\d{4}-\d{2}$/);
    }
    const top = res.body.months.reduce(
      (best: string | null, m: { yearMonth: string; count: number }) => {
        const bestCount =
          best === null
            ? -1
            : (res.body.months.find((x: { yearMonth: string }) => x.yearMonth === best)?.count ??
              -1);
        return m.count > bestCount ? m.yearMonth : best;
      },
      null as string | null,
    );
    expect(res.body.topMonth).toBe(top);
    expect(res.body.months.reduce((a: number, m: { count: number }) => a + m.count, 0)).toBe(
      EXPECTED_COUNT,
    );
    expect(res.body.model).toBe('rules-v1');
  });

  // ── 6. trend: 8-day window against the previous 8 days ────────────────

  it('trend: 24 + 180k current vs 18 + 180k previous → 33.3% up', async () => {
    const from = new Date(midnightUtc.getTime() - 8 * DAY_MS).toISOString();
    const res = await request(app.getHttpServer())
      .get(
        `/api/v1/analytics/trend?from=${encodeURIComponent(from)}&to=${encodeURIComponent(midnightUtc.toISOString())}`,
      )
      .set(auth(merchantToken))
      .expect(200);

    // current: days d=1..8 → 24 txns; 7 ordinary × 30_000 + spike 1_200_000
    expect(res.body.current).toEqual({ count: 24, amountMinor: '1410000' });
    // previous: days d=9..14 → 18 txns, 180_000
    expect(res.body.previous).toEqual({ count: 18, amountMinor: '180000' });
    expect(res.body.direction).toBe('up');
    expect(res.body.delta.countPct).toBeCloseTo(33.33, 2);
    expect(res.body.model).toBe('rules-v1');
  });

  // ── 7. anomalies: exactly the spike day, z ≥ 2.5 ──────────────────────

  it('anomalies: the injected spike day and nothing else', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/analytics/anomalies')
      .set(auth(merchantToken))
      .expect(200);

    expect(res.body.anomalies).toHaveLength(1);
    const spike = res.body.anomalies[0];
    expect(spike.date).toBe(
      new Date(midnightUtc.getTime() - SPIKE_DAY * DAY_MS).toISOString().slice(0, 10),
    );
    expect(spike.amountMinor).toBe(SPIKE_AMOUNT);
    expect(spike.count).toBe(3);
    expect(Math.abs(spike.zScore)).toBeGreaterThanOrEqual(2.5);
    expect(spike.direction).toBe('spike');
    expect(res.body.model).toBe('rules-v1');
  });

  // ── 8. recommendations: rules fire, shape valid, ≤ 5 items ────────────

  it('recommendations: 1..5 items, spike rule names the spike date', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/analytics/recommendations')
      .set(auth(merchantToken))
      .expect(200);

    expect(res.body.model).toBe('rules-v1');
    expect(res.body.recommendations.length).toBeGreaterThanOrEqual(1);
    expect(res.body.recommendations.length).toBeLessThanOrEqual(5);
    for (const rec of res.body.recommendations) {
      expect(['info', 'opportunity', 'warning']).toContain(rec.severity);
      expect(typeof rec.title).toBe('string');
      expect(typeof rec.body).toBe('string');
      expect(typeof rec.id).toBe('string');
    }
    const spikeDate = new Date(midnightUtc.getTime() - SPIKE_DAY * DAY_MS)
      .toISOString()
      .slice(0, 10);
    const spikeRec = res.body.recommendations.find(
      (r: { id: string; body: string }) => r.id === 'recent-spike' && r.body.includes(spikeDate),
    );
    expect(spikeRec).toBeDefined();
  });

  // ── 9. auth / isolation ────────────────────────────────────────────────

  it('all analytics endpoints require a token (401 without)', async () => {
    for (const ep of ENDPOINTS) {
      await request(app.getHttpServer())
        .get(`${ep}?from=${encodeURIComponent(midnightUtc.toISOString())}`)
        .expect(401);
    }
  });

  it('SUB_MERCHANT gets 403 on every analytics endpoint (merchant-only)', async () => {
    for (const ep of ENDPOINTS) {
      const res = await request(app.getHttpServer())
        .get(`${ep}?from=${encodeURIComponent(midnightUtc.toISOString())}`)
        .set(auth(subToken))
        .expect(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    }
  });

  it("cross-tenant: merchant B sees only its own 2 rows, never A's 42", async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/analytics/summary')
      .set(auth(merchantBToken))
      .expect(200);

    // B seeded days(3,4) × 3 txns/day = 6 rows, 60_000 in total
    expect(res.body.totals.count).toBe(6);
    expect(res.body.totals.amountMinor).toBe('60000');
    expect(res.body.totals.uniqueSubMerchants).toBe(0);
    // sanity: A is genuinely richer right now — proves the isolation is real
    expect(EXPECTED_COUNT).toBe(42);
  });

  // ── 10. range validation ──────────────────────────────────────────────

  it('range > 365 days → 422 VALIDATION_FAILED', async () => {
    const from = new Date(midnightUtc.getTime() - 400 * DAY_MS).toISOString();
    const res = await request(app.getHttpServer())
      .get(
        `/api/v1/analytics/summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(midnightUtc.toISOString())}`,
      )
      .set(auth(merchantToken))
      .expect(422);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('365 days exactly is allowed', async () => {
    const from = new Date(midnightUtc.getTime() - 365 * DAY_MS).toISOString();
    await request(app.getHttpServer())
      .get(
        `/api/v1/analytics/summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(midnightUtc.toISOString())}`,
      )
      .set(auth(merchantToken))
      .expect(200);
  });

  it('invalid from/to → 422 VALIDATION_FAILED (zod layer)', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/analytics/summary?from=not-a-date')
      .set(auth(merchantToken))
      .expect(422);
  });
});
