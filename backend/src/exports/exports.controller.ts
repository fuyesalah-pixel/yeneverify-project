// ============================================================
// Yene Verify — Exports Controller (Step 19)
//
// POST /api/v1/exports       request an export (202, async)
// GET  /api/v1/exports/:id   status + presigned URL when READY
// GET  /api/v1/exports       paginated history
//
// Scoping identical to billing: the merchant id is resolved from
// the DB by the global TenantGuard (never a JWT claim) and export
// rows are merchant-level views — sub-merchants get 403.
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
import { ExportsService } from './exports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentTenant, requireTenant } from '../common/decorators/current-tenant.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CreateExportDtoSchema } from './dto/create-export.dto';
import type { CreateExportDto } from './dto/create-export.dto';
import { ListExportsQuerySchema } from './dto/list-exports.query';
import type { ListExportsQuery } from './dto/list-exports.query';
import type {
  ExportCreatedResponseDto,
  ExportDetailResponseDto,
  ExportListResponseDto,
} from './dto/export-response.dto';
import type { AuthUser } from '../common/types/auth-user.type';

@ApiTags('Exports')
@Controller({ path: 'exports', version: '1' })
@UseGuards(JwtAuthGuard)
@Roles('MERCHANT')
export class ExportsController {
  constructor(private readonly service: ExportsService) {}

  // ── POST /exports ─────────────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Request a CSV or PDF export (processed async)' })
  @ApiResponse({ status: 202, description: 'Export queued' })
  @ApiResponse({ status: 400, description: 'No data, or row cap exceeded (EXPORT_TOO_LARGE)' })
  @ApiResponse({ status: 422, description: 'Validation failed (format, dates, range span)' })
  async create(
    @CurrentUser() user: AuthUser,
    @CurrentTenant() tenant: { merchantId: string } | undefined,
    @Body(new ZodValidationPipe(CreateExportDtoSchema)) dto: CreateExportDto,
  ): Promise<ExportCreatedResponseDto> {
    return this.service.create({
      merchantId: requireTenant(tenant),
      userId: user.id,
      dto,
    });
  }

  // ── GET /exports/:id ──────────────────────────────────────────────────

  @Get(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: "Get one export's status and download URL when ready" })
  @ApiResponse({ status: 200, description: 'Export detail (downloadUrl only when READY)' })
  @ApiResponse({ status: 404, description: 'Not found in this tenant, or file missing' })
  async getById(
    @CurrentTenant() tenant: { merchantId: string } | undefined,
    @Param('id') exportId: string,
  ): Promise<ExportDetailResponseDto> {
    return this.service.getById({
      merchantId: requireTenant(tenant),
      exportId,
    });
  }

  // ── GET /exports ──────────────────────────────────────────────────────

  @Get()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: "List this merchant's past exports" })
  async list(
    @CurrentTenant() tenant: { merchantId: string } | undefined,
    @Query(new ZodValidationPipe(ListExportsQuerySchema)) query: ListExportsQuery,
  ): Promise<ExportListResponseDto> {
    return this.service.list({
      merchantId: requireTenant(tenant),
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      status: query.status,
    });
  }
}
