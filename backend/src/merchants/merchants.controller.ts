// ============================================================
// Yene Verify — Merchants Controller
// REST endpoints for merchant profile management.
// ============================================================

import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { MerchantsService } from './merchants.service';
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
  async getMe(@CurrentUser() user: { id: string }) {
    return this.service.getMe(user.id);
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
