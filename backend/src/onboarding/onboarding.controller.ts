// ============================================================
// Yene Verify — Onboarding Controller
// REST endpoints for onboarding status and merchant setup.
// ============================================================

import { Controller, Get, Post, Body, Ip, Req, HttpCode, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { Request } from 'express';
import { OnboardingService } from './onboarding.service';
import { OnboardingStatusService } from './onboarding-status.service';
import { CreateMerchantDto } from './dto/create-merchant.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SkipOnboarding } from '../common/decorators/skip-onboarding.decorator';
import { SkipTenant } from '../common/decorators/skip-tenant.decorator';

@ApiTags('Onboarding')
@Controller({ path: 'onboarding', version: '1' })
export class OnboardingController {
  constructor(
    private readonly service: OnboardingService,
    private readonly statusService: OnboardingStatusService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @SkipOnboarding()
  @SkipTenant()
  @Get('status')
  @HttpCode(200)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get onboarding status for current user' })
  @ApiResponse({ status: 200, description: 'Onboarding status for the current user' })
  async getStatus(@CurrentUser() user: { id: string; role: string }) {
    return this.statusService.getStatus(user);
  }

  @UseGuards(JwtAuthGuard)
  @SkipOnboarding()
  @SkipTenant()
  @Post('merchant')
  @HttpCode(201)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create merchant profile (onboarding)' })
  @ApiResponse({ status: 201, description: 'Merchant created successfully' })
  @ApiResponse({ status: 409, description: 'Merchant already onboarded' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  async createMerchant(
    @CurrentUser() user: { id: string; role: string },
    @Body() dto: CreateMerchantDto,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    // The merchant is owned by the authenticated user — never a client- or
    // service-supplied id (the old stub passed '' and broke the FK).
    return this.service.createMerchant(user.id, dto, ip, req.headers['user-agent']);
  }
}
