// ============================================================
// Yene Verify — Billing Controller (Step 16)
//
// POST /api/v1/billing/initiate   instructions + billingSessionId (200)
// POST /api/v1/billing/submit     screenshot → verification queue (202)
// GET  /api/v1/billing/:id        status polling (200)
// GET  /api/v1/billing            paginated billing history (200)
//
// Scoping model identical to /verifications: merchant id resolved from
// the DB by the global TenantGuard (never a JWT claim); MERCHANT-only
// — sub-merchants buy packages for the business but billing sessions
// belong to the owner in the MVP (Step 17 admin surface extends this).
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
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentTenant, requireTenant } from '../common/decorators/current-tenant.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { InitiateBillingDtoSchema } from './dto/initiate-billing.dto';
import type { InitiateBillingDto } from './dto/initiate-billing.dto';
import { SubmitBillingDtoSchema } from './dto/submit-billing.dto';
import type { SubmitBillingDto } from './dto/submit-billing.dto';
import { BillingQuerySchema } from './dto/list-billing.query';
import type { BillingQuery } from './dto/list-billing.query';
import type {
  BillingDetailResponseDto,
  BillingInitiationResponseDto,
  BillingListResponseDto,
  BillingSubmittedResponseDto,
} from './dto/billing-response.dto';
import type { AuthUser } from '../common/types/auth-user.type';

@ApiTags('Billing')
@Controller({ path: 'billing', version: '1' })
@UseGuards(JwtAuthGuard)
@Roles('MERCHANT')
export class BillingController {
  constructor(private readonly service: BillingService) {}

  private merchantId(tenant: { merchantId: string } | undefined): string {
    return requireTenant(tenant);
  }

  // ── POST /billing/initiate ────────────────────────────────────────────

  @Post('initiate')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get payment instructions and open a billing session' })
  @ApiResponse({ status: 200, description: 'Instructions + billingSessionId' })
  @ApiResponse({
    status: 400,
    description: 'Package not purchasable (FREE / API / no price)',
  })
  async initiate(
    @CurrentUser() user: AuthUser,
    @CurrentTenant() tenant: { merchantId: string } | undefined,
    @Body(new ZodValidationPipe(InitiateBillingDtoSchema)) dto: InitiateBillingDto,
  ): Promise<BillingInitiationResponseDto> {
    return this.service.initiate({
      merchantId: this.merchantId(tenant),
      userId: user.id,
      dto,
    });
  }

  // ── POST /billing/submit ──────────────────────────────────────────────

  @Post('submit')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Submit the payment screenshot for verification' })
  @ApiResponse({ status: 202, description: 'Verification queued' })
  @ApiResponse({ status: 404, description: 'Billing session or receipt not found' })
  @ApiResponse({ status: 409, description: 'Session closed or receipt already used' })
  async submit(
    @CurrentUser() user: AuthUser,
    @CurrentTenant() tenant: { merchantId: string } | undefined,
    @Body(new ZodValidationPipe(SubmitBillingDtoSchema)) dto: SubmitBillingDto,
  ): Promise<BillingSubmittedResponseDto> {
    return this.service.submit({
      user,
      merchantId: this.merchantId(tenant),
      dto,
    });
  }

  // ── GET /billing/:id ──────────────────────────────────────────────────

  // Declared BEFORE the bare list route is irrelevant to method routing,
  // but `:id` and the literal paths above never collide in Nest.
  @Get(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: "Get one billing session's status" })
  @ApiResponse({ status: 200, description: 'Billing session detail' })
  @ApiResponse({ status: 404, description: 'Not found in this tenant' })
  async getById(
    @CurrentTenant() tenant: { merchantId: string } | undefined,
    @Param('id') billingSessionId: string,
  ): Promise<BillingDetailResponseDto> {
    return this.service.getForMerchant({
      merchantId: this.merchantId(tenant),
      billingSessionId,
    });
  }

  // ── GET /billing ──────────────────────────────────────────────────────

  @Get()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: "List the merchant's billing attempts" })
  @ApiResponse({ status: 200, description: 'Paginated billing list' })
  async list(
    @CurrentTenant() tenant: { merchantId: string } | undefined,
    @Query(new ZodValidationPipe(BillingQuerySchema)) query: BillingQuery,
  ): Promise<BillingListResponseDto> {
    return this.service.list({
      merchantId: this.merchantId(tenant),
      query: {
        page: query.page,
        pageSize: query.pageSize,
        status: query.status ?? null,
      },
    });
  }
}
