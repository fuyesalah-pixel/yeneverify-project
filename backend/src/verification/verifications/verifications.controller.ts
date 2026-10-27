// ============================================================
// Yene Verify — Verifications Controller (13E.3)
//
// POST   /api/v1/verifications            submit (202)
// GET    /api/v1/verifications            list (200, paginated)
// GET    /api/v1/verifications/:id        detail (200)
// POST   /api/v1/verifications/:id/retry  retry ERROR/NEEDS_REVIEW (202)
// POST   /api/v1/verifications/:id/request-review  MERCHANT flag (200)
//
// Scoping model: every handler takes the merchant id resolved from
// the DB by the global TenantGuard (NOT a JWT claim — tokens issued
// by the login flow carry no merchantId); VERIFIED/FAKE/DUPLICATE
// cannot be retried; review requests are
// MERCHANT-only. No new global filter — the existing
// AllExceptionsFilter maps the typed domain errors.
// ============================================================

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { VerificationsService } from './verifications.service';
import {
  CreateVerificationDto,
  CreateVerificationDtoSchema,
  ListVerificationsQuery,
  ListVerificationsQuerySchema,
  RequestReviewDto,
  RequestReviewDtoSchema,
} from './dto';
import {
  VerificationDetailDto,
  VerificationListResponseDto,
  RequestReviewResponseDto,
  RetryResponseDto,
  VerificationSubmittedResponseDto,
} from './dto/verification-response.dto';
import { VerificationSubmitRateGuard } from './verification-submit-rate.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentTenant, requireTenant } from '../../common/decorators/current-tenant.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthUser } from '../../common/types/auth-user.type';

@ApiTags('Verifications')
@Controller({ path: 'verifications', version: '1' })
@UseGuards(JwtAuthGuard)
@Roles('MERCHANT', 'SUB_MERCHANT')
export class VerificationsController {
  constructor(private readonly service: VerificationsService) {}

  private merchantId(tenant: { merchantId: string } | undefined): string {
    return requireTenant(tenant);
  }

  // ── POST /verifications ───────────────────────────────────────────────

  @Post()
  @UseGuards(VerificationSubmitRateGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Submit a receipt for bank verification' })
  @ApiResponse({ status: 202, description: 'Verification queued' })
  @ApiResponse({
    status: 400,
    description: 'Validation failed (billing fields for BILLING source)',
  })
  @ApiResponse({ status: 403, description: 'Sub-merchant verifying another uploader’s receipt' })
  @ApiResponse({ status: 404, description: 'Receipt not found in this tenant' })
  @ApiResponse({ status: 429, description: 'Submission rate limit exceeded' })
  async submit(
    @CurrentUser() user: AuthUser,
    @CurrentTenant() tenant: { merchantId: string } | undefined,
    @Body(new ZodValidationPipe(CreateVerificationDtoSchema)) dto: CreateVerificationDto,
  ): Promise<VerificationSubmittedResponseDto> {
    return this.service.submit({
      user,
      merchantId: this.merchantId(tenant),
      dto,
    });
  }

  // ── GET /verifications ────────────────────────────────────────────────

  @Get()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List verifications (tenant-scoped, paginated)' })
  @ApiResponse({ status: 200, description: 'Verification page' })
  async list(
    @CurrentUser() user: AuthUser,
    @CurrentTenant() tenant: { merchantId: string } | undefined,
    @Query(new ZodValidationPipe(ListVerificationsQuerySchema)) query: ListVerificationsQuery,
  ): Promise<VerificationListResponseDto> {
    return this.service.list({
      user,
      merchantId: this.merchantId(tenant),
      query,
    });
  }

  // ── GET /verifications/:id ────────────────────────────────────────────

  @Get(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get a verification’s status and result' })
  @ApiResponse({ status: 200, description: 'Verification detail' })
  @ApiResponse({ status: 404, description: 'Not found in this tenant' })
  async getById(
    @CurrentUser() user: AuthUser,
    @CurrentTenant() tenant: { merchantId: string } | undefined,
    @Param('id') verificationId: string,
  ): Promise<VerificationDetailDto> {
    return this.service.findByIdForUser({
      user,
      merchantId: this.merchantId(tenant),
      verificationId,
    });
  }

  // ── POST /verifications/:id/retry ─────────────────────────────────────

  @Post(':id/retry')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Retry a failed or under-review verification' })
  @ApiResponse({ status: 202, description: 'Re-enqueued for processing' })
  @ApiResponse({ status: 403, description: 'Sub-merchants cannot retry' })
  @ApiResponse({ status: 404, description: 'Verification not found in this tenant' })
  @ApiResponse({ status: 409, description: 'Verification already has a definitive verdict' })
  async retry(
    @CurrentUser() user: AuthUser,
    @CurrentTenant() tenant: { merchantId: string } | undefined,
    @Param('id') verificationId: string,
  ): Promise<RetryResponseDto> {
    return this.service.retry({
      user,
      merchantId: this.merchantId(tenant),
      verificationId,
    });
  }

  // ── POST /verifications/:id/request-review ────────────────────────────

  @Post(':id/request-review')
  @Roles('MERCHANT')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Flag a verification for manual review (merchant only)' })
  @ApiResponse({ status: 200, description: 'Flagged for manual review' })
  @ApiResponse({ status: 403, description: 'Sub-merchants cannot flag reviews' })
  @ApiResponse({ status: 404, description: 'Verification not found in this tenant' })
  @ApiResponse({ status: 409, description: 'Verification already has a definitive verdict' })
  async requestReview(
    @CurrentUser() user: AuthUser,
    @CurrentTenant() tenant: { merchantId: string } | undefined,
    @Param('id') verificationId: string,
    @Body(new ZodValidationPipe(RequestReviewDtoSchema)) dto: RequestReviewDto,
  ): Promise<RequestReviewResponseDto> {
    return this.service.requestReview({
      user,
      merchantId: this.merchantId(tenant),
      verificationId,
      dto,
    });
  }
}
