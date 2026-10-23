// ============================================================
// Yene Verify — Receipts Controller
// Three-step upload surface: reserve a key, confirm the upload, read
// metadata back. Storage writes never proxy through these endpoints —
// the client talks to object storage (or the local driver) directly.
// ============================================================

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ReceiptsService } from './receipts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { AuthUser } from '../common/types/auth-user.type';
import { PresignUploadDtoSchema, type PresignUploadDto } from './dto/presign-upload.dto';
import { CompleteUploadDtoSchema, type CompleteUploadDto } from './dto/complete-upload.dto';

@ApiTags('Receipts')
@Controller({ path: 'receipts', version: '1' })
@UseGuards(JwtAuthGuard)
@Roles('MERCHANT', 'SUB_MERCHANT')
export class ReceiptsController {
  constructor(private readonly service: ReceiptsService) {}

  @Post('presign')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Reserve a storage key and get an upload URL' })
  @ApiResponse({ status: 200, description: 'Upload URL issued' })
  @ApiResponse({ status: 400, description: 'Unsupported mimeType or oversized file' })
  async presign(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(PresignUploadDtoSchema)) dto: PresignUploadDto,
  ) {
    return this.service.presign(user, dto);
  }

  @Post('complete')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Confirm the upload and create the receipt' })
  @ApiResponse({ status: 201, description: 'Receipt created' })
  @ApiResponse({ status: 400, description: 'Checksum mismatch or invalid object' })
  @ApiResponse({ status: 404, description: 'No uploaded object for that key' })
  async complete(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CompleteUploadDtoSchema)) dto: CompleteUploadDto,
  ) {
    return this.service.complete(user, dto);
  }

  @Post(':id/ocr')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Run OCR on a stored receipt image' })
  @ApiResponse({ status: 200, description: 'Extracted OCR text' })
  @ApiResponse({ status: 403, description: 'Sub-merchant reading another uploader’s receipt' })
  @ApiResponse({ status: 404, description: 'Receipt not found in this tenant' })
  @ApiResponse({ status: 422, description: 'OCR provider returned no text' })
  @ApiResponse({ status: 502, description: 'OCR provider failure' })
  async runOcr(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.runOcr(id, user);
  }

  @Get(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get receipt metadata with a download URL' })
  @ApiResponse({ status: 200, description: 'Receipt metadata' })
  @ApiResponse({ status: 403, description: 'Sub-merchant reading another uploader’s receipt' })
  @ApiResponse({ status: 404, description: 'Receipt not found in this tenant' })
  async getById(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.getById(user, id);
  }
}
