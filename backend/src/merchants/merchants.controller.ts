// ============================================================
// Yene Verify — Merchants Controller
// REST endpoints for merchant profile management.
// ============================================================

import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { MerchantsService } from './merchants.service';
import { NotFoundError } from '../common/errors/domain-errors';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UpdateMerchantDto } from './dto/merchant.dto';

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
}
