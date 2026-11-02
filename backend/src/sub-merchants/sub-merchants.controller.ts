// ============================================================
// Yene Verify — Sub-Merchants Controller
// REST endpoints for sub-merchant management.
// Merchant side: invite/list/get/update/remove/resend.
// Invitee side: accept (authenticated), decline (token-only, public).
// All phone numbers in responses are masked server-side.
// ============================================================

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AppError } from '../common/errors/app-error';
import { ERROR_CODES } from '../common/constants/error-codes';
import { SubMerchantsService } from './sub-merchants.service';
import { SubMerchantInvitesService } from './sub-merchant-invites.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { SkipOnboarding } from '../common/decorators/skip-onboarding.decorator';
import { SkipTenant } from '../common/decorators/skip-tenant.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentTenant, TenantScope } from '../common/decorators/current-tenant.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  AcceptInviteDtoSchema,
  DeclineInviteDtoSchema,
  InviteSubMerchantDtoSchema,
  SubMerchantListQueryDtoSchema,
  UpdateSubMerchantDtoSchema,
} from './dto';

interface AuthedUser {
  id: string;
  role: 'ADMIN' | 'MERCHANT' | 'SUB_MERCHANT';
  merchantId?: string;
}

@ApiTags('Sub-Merchants')
@Controller({ path: 'sub-merchants', version: '1' })
@UseGuards(JwtAuthGuard)
export class SubMerchantsController {
  constructor(
    private readonly service: SubMerchantsService,
    private readonly invitesService: SubMerchantInvitesService,
  ) {}

  // ============================================================
  // Merchant side
  // ============================================================

  @Post('invite')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Invite a sub-merchant (team member)' })
  @ApiResponse({ status: 201, description: 'Invite created and delivered' })
  @ApiResponse({ status: 403, description: 'Plan limit reached' })
  @ApiResponse({ status: 409, description: 'Sub-merchant already exists' })
  async invite(
    @CurrentUser() user: AuthedUser,
    @CurrentTenant() tenant: TenantScope | undefined,
    @Body(new ZodValidationPipe(InviteSubMerchantDtoSchema))
    dto: { phone: string; name?: string; branchLabel?: string },
  ) {
    const merchantId = this.requireMerchantId(tenant);
    return this.invitesService.invite(merchantId, user.id, dto);
  }

  @Get()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List sub-merchants and pending invites' })
  @ApiResponse({ status: 200, description: 'Paginated list (phones masked)' })
  async list(
    @CurrentUser() _user: AuthedUser,
    @CurrentTenant() tenant: TenantScope | undefined,
    @Query(new ZodValidationPipe(SubMerchantListQueryDtoSchema))
    query: {
      status?: 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'REMOVED';
      search?: string;
      page: number;
      pageSize: number;
    },
  ) {
    return this.service.list(this.requireMerchantId(tenant), query);
  }

  @Get(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get sub-merchant or invite detail' })
  @ApiResponse({ status: 200, description: 'Detail (phone masked)' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async getById(
    @CurrentUser() _user: AuthedUser,
    @CurrentTenant() tenant: TenantScope | undefined,
    @Param('id') id: string,
  ) {
    const item = await this.service.getById(this.requireMerchantId(tenant), id);
    if (!item) {
      return null; // controller-level 404 mapping stays envelope-friendly
    }
    return item;
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update sub-merchant (branch label)' })
  @ApiResponse({ status: 200, description: 'Updated' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async update(
    @CurrentUser() _user: AuthedUser,
    @CurrentTenant() tenant: TenantScope | undefined,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateSubMerchantDtoSchema)) dto: { branchLabel?: string },
  ) {
    await this.service.update(this.requireMerchantId(tenant), id, dto);
    return { ok: true };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Remove sub-merchant or revoke pending invite' })
  @ApiResponse({ status: 204, description: 'Removed' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async remove(
    @CurrentUser() _user: AuthedUser,
    @CurrentTenant() tenant: TenantScope | undefined,
    @Param('id') id: string,
  ) {
    await this.service.remove(this.requireMerchantId(tenant), id);
  }

  @Post('invites/:id/resend')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Resend an invite (new token, extended expiry)' })
  @ApiResponse({ status: 200, description: 'Invite resent' })
  @ApiResponse({ status: 403, description: 'Max resends reached' })
  @ApiResponse({ status: 404, description: 'Invite not found' })
  async resendInvite(
    @CurrentUser() _user: AuthedUser,
    @CurrentTenant() tenant: TenantScope | undefined,
    @Param('id') inviteId: string,
  ) {
    return this.invitesService.resendInvite(this.requireMerchantId(tenant), inviteId);
  }

  // ============================================================
  // Invitee side
  // ============================================================

  // Accept is how a user LEAVES the onboarding gate — it cannot itself
  // require onboarding or a tenant (a pending invitee has no merchant yet).
  @SkipOnboarding()
  @SkipTenant()
  @Post('accept')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Accept a sub-merchant invite (phone must match)' })
  @ApiResponse({ status: 200, description: 'Invite accepted; role changed to SUB_MERCHANT' })
  @ApiResponse({ status: 400, description: 'Invalid/expired invite or phone mismatch' })
  @ApiResponse({ status: 409, description: 'Invite already used' })
  async accept(
    @CurrentUser() user: AuthedUser,
    @Body(new ZodValidationPipe(AcceptInviteDtoSchema)) dto: { token: string },
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.invitesService.acceptInvite(user.id, dto.token, ip, req.headers['user-agent']);
  }

  @Public()
  @SkipOnboarding()
  @SkipTenant()
  @Post('decline')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Decline a sub-merchant invite (token-only, idempotent)' })
  @ApiResponse({ status: 200, description: 'Invite declined' })
  @ApiResponse({ status: 400, description: 'Invalid or expired invite' })
  @ApiResponse({ status: 409, description: 'Invite already accepted' })
  async decline(
    @Body(new ZodValidationPipe(DeclineInviteDtoSchema)) dto: { token: string },
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.invitesService.declineInvite(dto.token, ip, req.headers['user-agent']);
  }

  // ── helpers ─────────────────────────────────────────────────────────────

  private requireMerchantId(tenant: TenantScope | undefined): string {
    if (!tenant?.merchantId) {
      // TenantRequiredGuard normally rejects earlier; this keeps the
      // controller safe if a route is ever mounted without it.
      throw new AppError(ERROR_CODES.MERCHANT_NOT_ONBOARDED, 'Merchant onboarding required.', 403);
    }
    return tenant.merchantId;
  }
}
