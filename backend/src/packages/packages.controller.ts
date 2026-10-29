// ============================================================
// Yene Verify — Packages Controller (Step 17)
//
// GET /api/v1/packages           catalog (public pricing material)
// GET /api/v1/packages/:code     single package (public)
// GET /api/v1/subscription/me    merchant's own subscription state
//
// READ-ONLY by design — packages are seeded from
// shared/constants/packages.json; there is deliberately no
// create/edit/subscribe endpoint in this module (admin web and the
// billing flow own every subscription mutation).
// ============================================================

import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { PackagesService } from './packages.service';
import { CurrentTenant, requireTenant } from '../common/decorators/current-tenant.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { NotFoundError } from '../common/errors/domain-errors';
import type { PackageResponseDto, PackageListResponseDto } from './dto/package-response.dto';
import type { SubscriptionMeResponseDto } from './dto/subscription-response.dto';

/** Package codes are fixed-enum strings; malformed junk 404s like any unknown code. */
const PackageCodeParamSchema = z
  .string()
  .min(2)
  .max(32)
  .regex(/^[A-Z][A-Z0-9_]*$/, 'Invalid package code');

@ApiTags('Packages')
@Controller({ version: '1' })
export class PackagesController {
  constructor(private readonly service: PackagesService) {}

  // ── GET /packages (public) ─────────────────────────────────────────────

  @Public()
  @Get('packages')
  @ApiOperation({ summary: 'List all active packages (public pricing page)' })
  @ApiResponse({ status: 200, description: 'Active packages, displayOrder ASC' })
  async list(): Promise<PackageListResponseDto> {
    return this.service.list();
  }

  @Public()
  @Get('packages/:code')
  @ApiOperation({ summary: 'Get one package by code (public)' })
  @ApiResponse({ status: 200, description: 'Package detail' })
  @ApiResponse({ status: 404, description: 'Unknown or inactive package' })
  async findOne(@Param('code') rawCode: string): Promise<PackageResponseDto> {
    // The ZodValidationPipe targets @Body/@Query; path params are
    // validated by hand — a malformed code 404s exactly like an unknown one.
    const parsed = PackageCodeParamSchema.safeParse(rawCode);
    if (!parsed.success) {
      throw new NotFoundError(`Package '${rawCode}' not found`);
    }
    return this.service.findOne(parsed.data);
  }

  // ── GET /subscription/me (merchant) ────────────────────────────────────

  @Get('subscription/me')
  @Roles('MERCHANT')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: "Get the current merchant's subscription state" })
  @ApiResponse({ status: 200, description: 'Subscription state (all-null pre-onboarding)' })
  async getMe(
    @CurrentTenant() tenant: { merchantId: string } | undefined,
  ): Promise<SubscriptionMeResponseDto> {
    return this.service.getMySubscription(requireTenant(tenant));
  }
}
