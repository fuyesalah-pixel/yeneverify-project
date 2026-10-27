// ============================================================
// Yene Verify — Credits Ledger E2E (real Postgres)
//
// Exercises CreditsService against the live schema: grant → consume
// (free + paid outcomes) → reconcile, plus the /merchants/me balance
// read model. No token minting shortcuts on the balance read: the
// app boots with the same global guards/interceptors the receipts
// and auth suites use.
//
// The credit ledger is append-only (UPDATE/DELETE are blocked by DB
// rules), so fixed fixture UUIDs would collide with rows left over
// from earlier runs and poison the baseline balance. Every entity
// here therefore gets FRESH ids per run; old rows are unreferenced
// garbage, cleaned best-effort in afterAll.
// ============================================================

import { Test } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { createHash, randomBytes } from 'crypto';
import { AppModule } from '../src/app.module';
import { AppConfigService } from '../src/config/config.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { TokenService } from '../src/auth/tokens/token.service';
import { CreditsService } from '../src/credits/credits.service';
import { newId } from '../src/common/utils/id.util';

describe('Credits ledger (e2e, real DB)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let credits: CreditsService;
  let accessToken: string;

  // Per-run fixture ids — fresh every run (see header note).
  const userId = newId();
  const deviceId = newId();
  const sessionId = newId();
  const merchantId = newId();
  const verification1 = newId();
  const verification2 = newId();
  const verificationFake = newId();
  const receipt1 = newId();
  const receipt2 = newId();
  const receiptFake = newId();
  const sweepIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication({ logger: false });
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
    credits = app.get(CreditsService);

    // The audit ledger is append-only, so fixture rows are upserted to
    // keep repeat runs idempotent (same pattern as the receipts suite).
    await prisma.user.upsert({
      where: { id: userId },
      update: { status: 'ACTIVE', role: 'MERCHANT' },
      create: {
        id: userId,
        // Unique per run — phone has a unique constraint and the ledger
        // blocks deleting old users, so a fixed phone only works once.
        phone: `+2519${Date.now().toString().slice(-8)}`,
        phoneVerifiedAt: new Date(),
        fullName: 'E2E Credits Merchant',
        role: 'MERCHANT',
        status: 'ACTIVE',
      },
    });

    await prisma.package.upsert({
      where: { code: 'BUSINESS' },
      update: { unlimited: false },
      create: {
        code: 'BUSINESS',
        name: 'Business',
        priceMinor: 99900n,
        creditsPerMonth: 400,
        unlimited: false,
      },
    });

    // merchant.subscriptionId is nullable, so create the merchant first
    // and link the subscription afterwards (the FK is immediate).
    await prisma.merchant.upsert({
      where: { id: merchantId },
      update: { status: 'ACTIVE' },
      create: {
        id: merchantId,
        ownerUserId: userId,
        businessName: 'E2E Credits Business',
        status: 'ACTIVE',
      },
    });

    const subscriptionId = newId();
    const subscription = await prisma.subscription.upsert({
      where: { id: subscriptionId },
      update: { status: 'ACTIVE', expiresAt: new Date(Date.now() + 30 * 86_400_000) },
      create: {
        id: subscriptionId,
        merchantId,
        packageCode: 'BUSINESS',
        status: 'ACTIVE',
        autoRenew: false,
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 86_400_000),
      },
    });
    await prisma.merchant.update({
      where: { id: merchantId },
      data: { subscriptionId: subscription.id },
    });

    await prisma.device.upsert({
      where: { id: deviceId },
      update: { revokedAt: null },
      create: {
        id: deviceId,
        userId,
        deviceFingerprint: `e2e-credits-${randomBytes(6).toString('hex')}`,
        platform: 'ANDROID',
      },
    });
    await prisma.session.upsert({
      where: { id: sessionId },
      update: { revokedAt: null, expiresAt: new Date(Date.now() + 3_600_000) },
      create: {
        id: sessionId,
        userId,
        deviceId,
        refreshTokenHash: createHash('sha256')
          .update(`e2e-credits-refresh-${randomBytes(8).toString('hex')}`)
          .digest('hex'),
        expiresAt: new Date(Date.now() + 3_600_000),
      },
    });

    accessToken = moduleRef.get(TokenService).signAccessToken({
      sub: userId,
      role: 'MERCHANT',
      merchantId,
      sid: sessionId,
      did: deviceId,
    });
  }, 60_000);

  afterAll(async () => {
    // The CONSUME/ADJUSTMENT ledger rows are immutable (DB RULE blocks
    // UPDATE and DELETE) and their Restrict FKs block deleting the
    // verification rows they reference — so fixture rows stay behind,
    // exactly like the receipts auth suite. Cheap rows are best-effort;
    // nothing here can collide with a later run (fresh ids each time).
    for (const id of [verification1, verification2, verificationFake, ...sweepIds]) {
      await prisma.verification.delete({ where: { id } }).catch(() => undefined);
    }
    for (const id of [receipt1, receipt2, receiptFake]) {
      await prisma.receipt.delete({ where: { id } }).catch(() => undefined);
    }
    await app.close();
  });

  const auth = () => ({ Authorization: `Bearer ${accessToken}` });

  async function seedVerification(id: string, receiptId: string, status: string): Promise<void> {
    await prisma.receipt.upsert({
      where: { id: receiptId },
      update: {},
      create: {
        id: receiptId,
        merchantId,
        uploadedByUserId: userId,
        storageKey: `receipts/${merchantId}/${id}.jpg`,
        mimeType: 'image/jpeg',
        sizeBytes: 1,
        sha256: createHash('sha256').update(id).digest('hex'),
        inputMethod: 'UPLOAD',
      },
    });
    await prisma.verification.upsert({
      where: { id },
      update: { status: status as never },
      create: {
        id,
        merchantId,
        verifiedByUserId: userId,
        receiptId,
        source: 'TRANSACTION',
        status: status as never,
      },
    });
  }

  it('runs the full ledger lifecycle on a real database', async () => {
    // ── baseline: balance is 0 on a fresh merchant ───────────────────────
    const me0 = await request(app.getHttpServer())
      .get('/api/v1/merchants/me')
      .set(auth())
      .expect(200);
    expect(me0.body.creditsBalance).toBe('0'); // string, not "undefined"

    const base = await credits.getBalance(merchantId);
    expect(base.balance).toBe(0n);
    expect(base.unlimited).toBe(false);

    // ── grant 10 credits ─────────────────────────────────────────────────
    const grant = await credits.grant({
      merchantId,
      amount: 10n,
      type: 'GRANT',
      reason: 'BUSINESS package activation',
    });
    expect(grant.granted).toBe(10n);
    expect(grant.newBalance).toBe(10n);

    // ── consume VERIFIED → 9 ─────────────────────────────────────────────
    await seedVerification(verification1, receipt1, 'VERIFIED');
    const c1 = await credits.consume({
      merchantId,
      verificationId: verification1,
      verificationStatus: 'VERIFIED',
    });
    expect(c1.consumed).toBe(1n);
    expect(c1.newBalance).toBe(9n);
    expect(c1.txId).toBeTruthy();

    // ── consume FAKE → still 9 (fraud detection is free) ────────────────
    await seedVerification(verificationFake, receiptFake, 'FAKE');
    const c2 = await credits.consume({
      merchantId,
      verificationId: verificationFake,
      verificationStatus: 'FAKE',
    });
    expect(c2.consumed).toBe(0n);
    expect(c2.txId).toBeNull();
    const afterFake = await credits.getBalance(merchantId);
    expect(afterFake.balance).toBe(9n);

    // ── second VERIFIED verification → 8 ─────────────────────────────────
    await seedVerification(verification2, receipt2, 'VERIFIED');
    const c3 = await credits.consume({
      merchantId,
      verificationId: verification2,
      verificationStatus: 'VERIFIED',
    });
    expect(c3.consumed).toBe(1n);
    expect(c3.newBalance).toBe(8n);

    // ── reconcile: cache and ledger already agree ────────────────────────
    const recon0 = await credits.reconcile(merchantId);
    expect(recon0.adjusted).toBe(false);
    expect(recon0.drift).toBe(0n);

    // ── corrupt the CACHE out-of-band → reconcile snaps it back ──────────
    await prisma.merchant.update({
      where: { id: merchantId },
      data: { creditsBalance: 100n },
    });
    const recon1 = await credits.reconcile(merchantId);
    expect(recon1.adjusted).toBe(true);
    expect(recon1.drift).toBe(-92n); // ledger(8) - cache(100)
    expect(recon1.previousBalance).toBe(100n);
    expect(recon1.ledgerBalance).toBe(8n);

    const after = await credits.getBalance(merchantId);
    expect(after.balance).toBe(8n);

    // The ADJUSTMENT audit row is in the history but must NOT be part of
    // the balance — otherwise every reconcile shifts the sum it measured.
    const reconStable = await credits.reconcile(merchantId);
    expect(reconStable.adjusted).toBe(false); // cache(8) still equals ledger(8)
    expect(reconStable.drift).toBe(0n);

    // ── submission gate reflects the running balance ─────────────────────
    const gate0 = await credits.checkSubmissionAllowed(merchantId);
    expect(gate0.allowed).toBe(true);
    expect(gate0.balance).toBe(8n);

    // Spend everything → INSUFFICIENT_CREDITS
    for (let i = 0; i < 8; i++) {
      const v = newId();
      sweepIds.push(v);
      const r = newId();
      await seedVerification(v, r, 'VERIFIED');
      await credits.consume({ merchantId, verificationId: v, verificationStatus: 'VERIFIED' });
    }
    const gate1 = await credits.checkSubmissionAllowed(merchantId);
    expect(gate1.allowed).toBe(false);
    expect(gate1.reason).toBe('INSUFFICIENT_CREDITS');

    // Idempotent replay: the same verificationId returns the STORED
    // result (balanceAfter at consume time, 8n) instead of double-
    // consuming past an empty balance.
    await expect(
      credits.consume({
        merchantId,
        verificationId: verification2,
        verificationStatus: 'VERIFIED',
      }),
    ).resolves.toMatchObject({ consumed: 1n, newBalance: 8n });
    // ...and the current balance must still be 0, not −1 (no double-cli).
    const replayed = await credits.getBalance(merchantId);
    expect(replayed.balance).toBe(0n);

    // ── history read model ───────────────────────────────────────────────
    const history = await credits.getHistory(merchantId, { page: 1, pageSize: 5 });
    expect(history.meta.total).toBeGreaterThanOrEqual(12); // 1 grant + 11 consumes + 1 adjustment
    expect(history.data[0].amount).toMatch(/^-?\d+$/);
  });
});
