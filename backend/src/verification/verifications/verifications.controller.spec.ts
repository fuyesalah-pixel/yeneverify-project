// ============================================================
// Yene Verify — Verifications Controller Unit Tests (13E.3)
//
// The controller is exercised directly against a mocked
// VerificationsService: every endpoint's HTTP verb/code, DTO shape
// and auth-scoped inputs are asserted. The ZodValidationPipe +
// guard wiring is covered by the e2e suite and the DTO schema tests.
// ============================================================

import { Test } from '@nestjs/testing';
import request from 'supertest';
import { VersioningType } from '@nestjs/common';
import { VerificationsController } from './verifications.controller';
import { VerificationsService } from './verifications.service';
import { VerificationSubmitRateGuard } from './verification-submit-rate.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { TenantIsolationError } from '../../common/errors/domain-errors';
import { AllExceptionsFilter } from '../../common/filters/all-exceptions.filter';
import type { AuthUser } from '../../common/types/auth-user.type';

const baseUser: AuthUser = {
  id: 'user-1',
  role: 'MERCHANT',
  merchantId: 'merchant-1',
};

const submitResponse = {
  verificationId: 'verif-1',
  status: 'PENDING' as const,
  createdAt: new Date('2026-10-01T00:00:00.000Z').toISOString(),
};

const detailResponse = {
  id: 'verif-1',
  status: 'VERIFIED' as const,
  source: 'TRANSACTION' as const,
  bankCode: 'CBE',
  bankReference: 'FT26195DBK5W81465291',
  amountMinor: '12000',
  senderName: 'Yonas Alemu',
  receiverName: 'Selam Coffee',
  paidAt: '2026-07-14T11:08:00.000Z',
  ocrConfidence: 0.98,
  errorCode: null,
  errorMessage: null,
  durationMs: 1200,
  duplicateOf: null,
  needsSupplementary: null,
  receipt: {
    id: 'receipt-1',
    mimeType: 'image/jpeg',
    sizeBytes: 1024,
    uploadedAt: new Date('2026-10-01T00:00:00.000Z').toISOString(),
  },
  createdAt: '2026-10-01T00:00:00.000Z',
  completedAt: '2026-10-01T00:00:02.000Z',
};

describe('VerificationsController (unit)', () => {
  let service: { submit: any; list: any; findByIdForUser: any; retry: any; requestReview: any };

  beforeEach(() => {
    service = {
      submit: jest.fn(async () => submitResponse),
      list: jest.fn(),
      findByIdForUser: jest.fn(async () => detailResponse),
      retry: jest.fn(),
      requestReview: jest.fn(),
    };
  });

  it('submit passes user + merchantId + parsed dto and returns 202-shaped result', async () => {
    const controller = new VerificationsController(service as never);
    const dto = { receiptId: 'receipt-1', source: 'TRANSACTION' } as never;

    const res = await controller.submit(baseUser, { merchantId: 'merchant-1' }, dto);

    expect(res.status).toBe('PENDING');
    expect(service.submit).toHaveBeenCalledWith({
      user: baseUser,
      merchantId: 'merchant-1',
      dto,
    });
  });

  it('submit without a merchant on the token → TenantIsolationError', async () => {
    const controller = new VerificationsController(service as never);

    await expect(
      controller.submit({ ...baseUser, merchantId: undefined }, undefined, {
        receiptId: 'receipt-1',
      } as never),
    ).rejects.toBeInstanceOf(TenantIsolationError);
    expect(service.submit).not.toHaveBeenCalled();
  });

  it('list passes query through unmodified', async () => {
    const controller = new VerificationsController(service as never);
    const query = {
      page: 2,
      pageSize: 10,
      sortBy: 'createdAt' as const,
      sortOrder: 'asc' as const,
    } as never;

    await controller.list(baseUser, { merchantId: 'merchant-1' }, query);

    expect(service.list).toHaveBeenCalledWith({
      user: baseUser,
      merchantId: 'merchant-1',
      query,
    });
  });

  it('getById routes to findByIdForUser with the requested id', async () => {
    const controller = new VerificationsController(service as never);

    const res = await controller.getById(baseUser, { merchantId: 'merchant-1' }, 'verif-9');

    expect(res.id).toBe('verif-1'); // mocked detail comes back untouched
    expect(service.findByIdForUser).toHaveBeenCalledWith({
      user: baseUser,
      merchantId: 'merchant-1',
      verificationId: 'verif-9',
    });
  });

  it('retry passes the verification id through', async () => {
    const controller = new VerificationsController(service as never);
    (service.retry as any).mockResolvedValue({ verificationId: 'verif-9', status: 'PENDING' });

    const res = await controller.retry(baseUser, { merchantId: 'merchant-1' }, 'verif-9');

    expect(res.status).toBe('PENDING');
    expect(service.retry).toHaveBeenCalledWith({
      user: baseUser,
      merchantId: 'merchant-1',
      verificationId: 'verif-9',
    });
  });

  it('requestReview passes dto.reason to the service', async () => {
    const controller = new VerificationsController(service as never);
    const dto = { reason: 'invoice dispute' } as never;
    (service.requestReview as any).mockResolvedValue({
      verificationId: 'verif-9',
      reviewId: 'review-1',
      status: 'NEEDS_REVIEW',
    });

    const res = await controller.requestReview(
      baseUser,
      { merchantId: 'merchant-1' },
      'verif-9',
      dto,
    );

    expect(res.status).toBe('NEEDS_REVIEW');
    expect(service.requestReview).toHaveBeenCalledWith({
      user: baseUser,
      merchantId: 'merchant-1',
      verificationId: 'verif-9',
      dto,
    });
  });

  it('class-level guards keep @Roles(MERCHANT, SUB_MERCHANT) metadata', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, VerificationsController);
    expect(roles).toEqual(['MERCHANT', 'SUB_MERCHANT']);
  });

  it('requestReview overrides roles to MERCHANT only', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, VerificationsController.prototype.requestReview);
    expect(roles).toEqual(['MERCHANT']);
  });

  it('wires into a minimal Nest app (guards mocked) and answers the endpoints', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [VerificationsController],
      providers: [{ provide: VerificationsService, useValue: service }],
    })
      // Controller-level @UseGuards(...) classes are instantiated from the
      // module DI container — overrideGuard stubs them so the mini app has
      // no JwtStrategy/Redis dependency.
      .overrideGuard(JwtAuthGuard)
      .useValue({
        // Auth stub AND user/tenant source: the controller needs req.user
        // and req.tenant (set by the global TenantGuard in the real app).
        canActivate: (ctx: {
          switchToHttp: () => { getRequest: () => Record<string, unknown> };
        }) => {
          const req = ctx.switchToHttp().getRequest();
          req['user'] = baseUser;
          req['tenant'] = { merchantId: 'merchant-1' };
          return true;
        },
      })
      .overrideGuard(VerificationSubmitRateGuard)
      .useValue({ canActivate: async () => true })
      .compile();

    const app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalFilters(new AllExceptionsFilter());
    // Small standalone app; no need to bind — supertest drives it.
    await app.init();

    // POST /verifications → 202
    const RECEIPT_UUID = '018f8c1a-0000-7000-8000-0000000e2e11';
    await request(app.getHttpServer())
      .post('/api/v1/verifications')
      .send({ receiptId: RECEIPT_UUID })
      .expect(202)
      .expect((res) => {
        expect(res.body.status).toBe('PENDING');
        expect(res.body.verificationId).toBe('verif-1');
      });
    expect((service.submit as any).mock.calls[0][0].dto).toEqual({
      receiptId: RECEIPT_UUID,
      source: 'TRANSACTION',
    });

    // GET /verifications/:id → 200
    await request(app.getHttpServer()).get('/api/v1/verifications/verif-1').expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/verifications')
      .send({ receiptId: 'not-a-uuid' })
      .expect(422);

    // POST /verifications/:id/retry → 202
    (service.retry as any).mockResolvedValue({ verificationId: 'verif-1', status: 'PENDING' });
    await request(app.getHttpServer()).post('/api/v1/verifications/verif-1/retry').expect(202);

    // POST /verifications/:id/request-review → 200
    (service.requestReview as any).mockResolvedValue({
      verificationId: 'verif-1',
      reviewId: 'review-1',
      status: 'NEEDS_REVIEW',
    });
    await request(app.getHttpServer())
      .post('/api/v1/verifications/verif-1/request-review')
      .send({ reason: 'checked' })
      .expect(200)
      .expect((res) => {
        expect(res.body.reviewId).toBe('review-1');
      });

    // GET list (supplied query parsed and forwarded)
    (service.list as any).mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    });
    await request(app.getHttpServer()).get('/api/v1/verifications?page=2&pageSize=10').expect(200);
    expect((service.list as any).mock.calls[0][0].query).toEqual(
      expect.objectContaining({ page: 2, pageSize: 10, sortBy: 'createdAt', sortOrder: 'desc' }),
    );

    await app.close();
  });
});
