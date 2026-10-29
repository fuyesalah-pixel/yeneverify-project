// ============================================================
// Yene Verify — Exports E2E (Step 19, real DB + real BullMQ)
//
// Full async pipeline: POST /exports → EXPORT queue → processor →
// local storage → presigned download → notification row.
//
// Fixtures are per-run (random ids + runTag) so suites stay
// hermetic: merchant A owns 100 transactions across 10 days,
// merchant B has 1 (cross-tenant proof), a sub-merchant user
// asserts the merchant-only surface, merchant C has no data.
//
// The presigned URL targets config.app.url — a base nobody is
// listening on in the test process — so the download is replayed
// through supertest by re-using the URL's path + query verbatim.
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
const TXN_COUNT = 100;
const TXN_DAYS = 10;

interface AuthFixture {
  userId: string;
  merchantId: string;
  deviceId: string;
  sessionId: string;
}

function makeFixture(): AuthFixture {
  return {
    userId: newId(),
    merchantId: newId(),
    deviceId: newId(),
    sessionId: newId(),
  };
}

describe('Exports (e2e, real DB + real queue)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenService: TokenService;

  const runTag = randomBytes(5).toString('hex');
  const merchantA = makeFixture();
  const merchantB = makeFixture();
  const merchantC = makeFixture(); // zero transactions → EXPORT_NO_DATA
  const sub = { ...makeFixture(), subMerchantId: newId() };

  let merchantToken: string;
  let merchantBToken: string;
  let subToken: string;

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

    await createMerchantUser(merchantA, 'Exports A');
    await createMerchantUser(merchantB, 'Exports B');
    await createMerchantUser(merchantC, 'Exports C');

    // Sub-merchant on A: TenantGuard reads sub_merchants for the role.
    await prisma.user.create({
      data: {
        id: sub.userId,
        phone: `+2519${Date.now().toString().slice(-7)}3`,
        phoneVerifiedAt: new Date(),
        fullName: 'E2E Exports Sub',
        role: 'SUB_MERCHANT',
        status: 'ACTIVE',
      },
    });
    await prisma.subMerchant.create({
      data: {
        id: sub.subMerchantId,
        userId: sub.userId,
        merchantId: merchantA.merchantId,
        status: 'ACTIVE',
        branchLabel: `E2E Exports Sub ${runTag}`,
        invitedAt: new Date(),
        joinedAt: new Date(),
      },
    });

    await createDeviceSession(merchantA);
    await createDeviceSession(merchantB);
    await createDeviceSession(merchantC);
    await createDeviceSession(sub);

    merchantToken = sign(merchantA, 'MERCHANT');
    merchantBToken = sign(merchantB, 'MERCHANT');
    subToken = sign(sub, 'SUB_MERCHANT');

    // ── Seed: A = 100 txns across 10 days; B = 1 txn; C = none ──────────
    await seedTransactions(merchantA.merchantId, merchantA.userId, TXN_COUNT, TXN_DAYS);
    await seedTransactions(merchantB.merchantId, merchantB.userId, 1, 1);
  }, 90_000);

  // ── fixture helpers ─────────────────────────────────────────────────────

  async function createMerchantUser(f: AuthFixture, name: string): Promise<void> {
    await prisma.user.create({
      data: {
        id: f.userId,
        phone: `+2519${Date.now().toString().slice(-7)}0`,
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
        deviceFingerprint: `e2e-exports-${runTag}-${f.deviceId.slice(0, 8)}`,
        platform: 'ANDROID',
      },
    });
    await prisma.session.create({
      data: {
        id: f.sessionId,
        userId: f.userId,
        deviceId: f.deviceId,
        refreshTokenHash: createHash('sha256')
          .update(`exports-${runTag}-${f.sessionId}`)
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

  async function seedTransactions(
    merchantId: string,
    ownerId: string,
    total: number,
    spanDays: number,
  ): Promise<void> {
    const perDay = Math.ceil(total / spanDays);
    let seq = 0;
    for (let d = 1; d <= spanDays && seq < total; d += 1) {
      for (let i = 0; i < perDay && seq < total; i += 1) {
        seq += 1;
        const receiptId = newId();
        const verificationId = newId();
        const paidAt = new Date(Date.now() - d * DAY_MS);

        await prisma.receipt.create({
          data: {
            id: receiptId,
            merchantId,
            uploadedByUserId: ownerId,
            storageKey: `e2e-exports/${runTag}/${merchantId.slice(0, 8)}/${seq}.jpg`,
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
            bankCode: seq % 2 === 0 ? 'CBE' : 'TELEBIRR',
            bankReference: `E2E19-${runTag}-${seq}`,
            amountMinor: BigInt(10_000 + seq * 100),
            senderName: `Sender-${seq}`,
            receiverName: 'Exports Merchant',
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
            verifiedByUserId: ownerId,
            bankCode: seq % 2 === 0 ? 'CBE' : 'TELEBIRR',
            bankReference: `E2E19-${runTag}-${seq}`,
            amountMinor: BigInt(10_000 + seq * 100),
            senderName: `Sender-${seq}`,
            paidAt,
            status: 'VERIFIED',
            productLabel: seq % 3 === 0 ? 'Coffee' : 'Tea',
          },
        });
      }
    }
  }

  async function waitForReady(
    exportId: string,
    timeoutMs = 30_000,
  ): Promise<{
    body: {
      status: string;
      rowCount: number | null;
      fileSizeBytes: number | null;
      downloadUrl: string | null;
      errorMessage: string | null;
    };
  }> {
    const deadline = Date.now() + timeoutMs;
    let last = {
      body: {
        status: 'QUEUED',
        rowCount: null,
        fileSizeBytes: null,
        downloadUrl: null,
        errorMessage: null,
      },
    };
    while (Date.now() < deadline) {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/exports/${exportId}`)
        .set(auth(merchantToken))
        .expect(200);
      last = res;
      if (res.body.status === 'READY' || res.body.status === 'FAILED') return res;
      await new Promise((r) => setTimeout(r, 400));
    }
    return last;
  }

  afterAll(async () => {
    // Best-effort sweep; users stay behind like the other real-DB suites.
    for (const f of [merchantA, merchantB, merchantC, sub]) {
      await prisma.transaction
        .deleteMany({ where: { merchantId: f.merchantId } })
        .catch(() => undefined);
      await prisma.verification
        .deleteMany({ where: { merchantId: f.merchantId } })
        .catch(() => undefined);
      await prisma.receipt
        .deleteMany({ where: { merchantId: f.merchantId } })
        .catch(() => undefined);
      await prisma.notification
        .deleteMany({ where: { merchantId: f.merchantId } })
        .catch(() => undefined);
      await prisma.export
        .deleteMany({ where: { merchantId: f.merchantId } })
        .catch(() => undefined);
      if ('subMerchantId' in f && f.subMerchantId) {
        await prisma.subMerchant
          .deleteMany({ where: { id: f.subMerchantId } })
          .catch(() => undefined);
      }
      await prisma.merchant.deleteMany({ where: { id: f.merchantId } }).catch(() => undefined);
    }
    await app.close();
  });

  // ── 1. CSV happy path ──────────────────────────────────────────────────

  let csvExportId: string;

  it('POST /exports CSV → 202 QUEUED with an exportId', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/exports')
      .set(auth(merchantToken))
      .send({ format: 'CSV' })
      .expect(202);
    expect(res.body.exportId).toBeTruthy();
    expect(res.body.status).toBe('QUEUED');
    csvExportId = res.body.exportId;
  });

  it('poll GET /exports/:id until READY: 100 rows, non-empty file, presigned URL', async () => {
    const res = await waitForReady(csvExportId);
    expect(res.body.status).toBe('READY');
    expect(res.body.errorMessage).toBeNull();
    expect(res.body.rowCount).toBe(TXN_COUNT);
    expect(res.body.fileSizeBytes).toBeGreaterThan(0);
    expect(typeof res.body.downloadUrl).toBe('string');
  });

  it('download: presigned URL serves the CSV — header + exactly 100 data rows', async () => {
    const detail = await waitForReady(csvExportId);
    const presigned = new URL(detail.body.downloadUrl as string);

    // Replay verbatim (path + '?token=…') — .query(URLSearchParams)
    // serializes to nothing and drops the token.
    const res = await request(app.getHttpServer()).get(presigned.pathname + presigned.search);

    expect(res.status).toBe(200);
    // The storage route sens Buffer bodies — read from res.body, not res.text.
    const csvText = Buffer.isBuffer(res.body) ? res.body.toString('utf8') : (res.text as string);
    expect(
      csvText.startsWith(
        'date,bank,reference,amount_etb,sender,receiver,status,sub_merchant,product\n',
      ),
    ).toBe(true);

    const dataRows = csvText.trimEnd().split('\n').slice(1);
    expect(dataRows).toHaveLength(TXN_COUNT);
    // Amount formatting: minor units → 2-decimal ETB; receiver is blank in
    // fixtures (null) — rows are paid_at ASC so the first row is day 10.
    expect(dataRows[0]).toMatch(
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2},(CBE|TELEBIRR),E2E19-[0-9a-f]+-\d+,\d+\.\d{2},Sender-\d+,,VERIFIED,,(Coffee|Tea)$/,
    );
  });

  it('a SYSTEM notification row exists for the requesting user', async () => {
    const rows = await prisma.notification.findMany({
      where: { merchantId: merchantA.merchantId, type: 'SYSTEM' },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe('Export ready');
    expect(rows[0].data).toMatchObject({ exportId: csvExportId });
  });

  // ── 2. PDF happy path ─────────────────────────────────────────────────

  it('POST /exports PDF → poll → READY and the file is a real PDF', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/exports')
      .set(auth(merchantToken))
      .send({ format: 'PDF' })
      .expect(202);

    const detail = await waitForReady(created.body.exportId);
    expect(detail.body.status).toBe('READY');
    expect(detail.body.rowCount).toBe(TXN_COUNT);

    const presigned = new URL(detail.body.downloadUrl as string);
    const res = await request(app.getHttpServer()).get(presigned.pathname + presigned.search);
    expect(res.status).toBe(200);
    // PDF-1.x magic bytes
    expect(res.body.length ?? res.text.length).toBeGreaterThan(500);
    const buf = Buffer.isBuffer(res.body) ? res.body : Buffer.from(res.text, 'binary');
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  // ── 3. validation ─────────────────────────────────────────────────────

  it('range > 366 days → 422 VALIDATION_FAILED', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/exports')
      .set(auth(merchantToken))
      .send({
        format: 'CSV',
        from: new Date(Date.now() - 400 * DAY_MS).toISOString(),
        to: new Date().toISOString(),
      })
      .expect(422);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('missing format → 422', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/exports')
      .set(auth(merchantToken))
      .send({})
      .expect(422);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('merchant with zero matching transactions → 400 EXPORT_NO_DATA', async () => {
    // Fresh module token for C: its own JWT, zero transactions.
    const res = await request(app.getHttpServer())
      .post('/api/v1/exports')
      .set('Authorization', `Bearer ${sign(merchantC, 'MERCHANT')}`)
      .send({ format: 'CSV' })
      .expect(400);
    expect(res.body.error.code).toBe('EXPORT_NO_DATA');
  });

  // ── 4. auth / isolation ───────────────────────────────────────────────

  it('401 without a token (create + status + list)', async () => {
    await request(app.getHttpServer()).post('/api/v1/exports').send({ format: 'CSV' }).expect(401);
    await request(app.getHttpServer()).get('/api/v1/exports').expect(401);
    await request(app.getHttpServer()).get(`/api/v1/exports/${csvExportId}`).expect(401);
  });

  it('SUB_MERCHANT gets 403 on POST /exports (merchant-only surface)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/exports')
      .set(auth(subToken))
      .send({ format: 'CSV' })
      .expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('cross-tenant: merchant B gets 404 on A\u2019s export id', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/exports/${csvExportId}`)
      .set(auth(merchantBToken))
      .expect(404);
    expect(res.body.error.code).toBe('EXPORT_NOT_FOUND');
  });

  it('GET /exports lists A\u2019s two exports newest-first', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/exports?page=1&pageSize=10')
      .set(auth(merchantToken))
      .expect(200);
    expect(res.body.meta.total).toBe(2);
    expect(res.body.data).toHaveLength(2);
    expect([res.body.data[0].format, res.body.data[1].format]).toEqual(['PDF', 'CSV']);
    expect(new Date(res.body.data[0].createdAt) >= new Date(res.body.data[1].createdAt)).toBe(true);
  });
});
