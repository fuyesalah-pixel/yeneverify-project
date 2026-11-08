// ============================================================
// Yene Verify â€” Waitlist Controller
// POST /api/v1/waitlist (public, no auth).
// ============================================================

import {
  Body,
  Controller,
  Post,
  Ip,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { SkipOnboarding } from '../common/decorators/skip-onboarding.decorator';
import { SkipTenant } from '../common/decorators/skip-tenant.decorator';
import { CreateWaitlistDtoSchema, type CreateWaitlistDto } from './dto/create-waitlist.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { WaitlistService } from './waitlist.service';
import type { Response as ExpressResponse } from 'express';

@ApiTags('Waitlist')
@Controller({ path: 'waitlist', version: '1' })
@Public()
@SkipOnboarding()
@SkipTenant()
export class WaitlistController {
  constructor(private readonly waitlist: WaitlistService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Join the Yene Verify launch waitlist' })
  @ApiResponse({ status: 201, description: 'Added to waitlist' })
  @ApiResponse({ status: 200, description: 'Already on the waitlist (idempotent)' })
  @ApiResponse({ status: 429, description: 'Rate limited' })
  async subscribe(
    @Body(new ZodValidationPipe(CreateWaitlistDtoSchema)) dto: CreateWaitlistDto,
    @Ip() ip: string,
    @Res() res: ExpressResponse,
  ) {
    const { created } = await this.waitlist.subscribe({ ...dto, ip });
    return res.status(created ? HttpStatus.CREATED : HttpStatus.OK).json({ ok: true });
  }
}
