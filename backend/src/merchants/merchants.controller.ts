// ============================================================
// Yene Verify — Merchants Controller
// REST endpoints for merchant profile management.
// ============================================================

import { Controller, Get, Patch, Put, Body, UseGuards, Req, Ip } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiHeader, ApiResponse } from '@nestjs/swagger';
import type { Request } from 'express';
import { MerchantsService } from './merchants.service';
import { NotFoundError } from '../common/errors/domain-errors';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireStepUp, StepUpGuard } from '../auth/step-up';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { UpdateMerchantDto } from './dto/merchant.dto';
import {
  VerificationAccountsUpdateSchema,
  type VerificationAccountsUpdate,
} from './dto/verification-accounts.dto';
import { SUPPORTED_VERIFICATION_BANKS } from './verification-accounts';

@ApiTags('Merchants')
@Controller({ path: 'merchants', version: '1' })
export class MerchantsController {
  constructor(private readonly service: MerchantsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get current merchant profile' })
  @ApiResponse({ status: 200, description: 'Merchant profile' })
  async getMe(@CurrentUser() user: { id: string; merchantId?: string }) {
    // The service expects the MERCHANT id (not the user id). Tokens issued
    // before onboarding carry no merchantId claim — resolve by ownership.
    const me = user.merchantId
      ? await this.service.getMe(user.merchantId)
      : await this.service.getMeByOwner(user.id);
    if (!me) {
      throw new NotFoundError('No merchant profile found for this user');
    }
    // bigint → string: JSON.stringify(bigint) throws (no polyfill exists)
    return { ...me, creditsBalance: String(me.creditsBalance) };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update merchant profile' })
  @ApiResponse({ status: 200, description: 'Profile updated' })
  async updateMe(@CurrentUser() user: { id: string }, @Body() dto: UpdateMerchantDto) {
    return this.service.updateMe(user.id, dto);
  }

  // ── Verification accounts ─────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Roles('MERCHANT')
  @Get('me/verification-accounts')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get bank accounts used for verification' })
  @ApiResponse({ status: 200, description: 'Configured verification accounts' })
  async getVerificationAccounts(@CurrentUser() user: { id: string; merchantId?: string }) {
    return {
      verificationAccounts: await this.service.getVerificationAccounts(user),
    };
  }

  @UseGuards(JwtAuthGuard, StepUpGuard)
  @Roles('MERCHANT')
  @RequireStepUp()
  @Put('me/verification-accounts')
  @ApiBearerAuth('access-token')
  @ApiHeader({
    name: 'X-Step-Up-Token',
    description: 'Step-up token from PIN verify or biometric step-up',
  })
  @ApiOperation({ summary: 'Update verification accounts (requires step-up)' })
  @ApiResponse({ status: 200, description: 'Verification accounts updated' })
  @ApiResponse({ status: 401, description: 'Missing, invalid, or expired step-up token' })
  async updateVerificationAccounts(
    @CurrentUser() user: { id: string; merchantId?: string },
    @Body(new ZodValidationPipe(VerificationAccountsUpdateSchema))
    dto: VerificationAccountsUpdate,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    return {
      verificationAccounts: await this.service.updateVerificationAccounts(
        user,
        dto,
        ip,
        req.headers['user-agent'],
      ),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Roles('MERCHANT')
  @Get('me/verification-accounts/supported-banks')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List banks and fields supported for verification accounts' })
  @ApiResponse({ status: 200, description: 'Supported banks and their required fields' })
  getSupportedBanks() {
    return { banks: SUPPORTED_VERIFICATION_BANKS };
  }
}
