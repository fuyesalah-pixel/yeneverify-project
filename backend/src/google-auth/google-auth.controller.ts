// ============================================================
// Yene Verify â€” Google Auth Controller
// POST /api/v1/auth/google | /auth/google/link | /auth/google/unlink
// ============================================================

import {
  Body,
  Controller,
  Post,
  Ip,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { SkipOnboarding } from '../common/decorators/skip-onboarding.decorator';
import { SkipTenant } from '../common/decorators/skip-tenant.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GoogleIdTokenDtoSchema, type GoogleIdTokenDto } from './dto/google-auth.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { GoogleAuthService } from './google-auth.service';

@ApiTags('Google Auth')
@Controller({ path: 'auth/google', version: '1' })
export class GoogleAuthController {
  constructor(private readonly googleAuth: GoogleAuthService) {}

  @Public()
  @SkipOnboarding()
  @SkipTenant()
  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in with a linked Google account (ID token)' })
  @ApiResponse({ status: 200, description: 'Access + refresh tokens issued' })
  @ApiResponse({ status: 401, description: 'Invalid or unverified Google token' })
  @ApiResponse({ status: 403, description: 'Google account not linked to a user' })
  @ApiResponse({ status: 429, description: 'Rate limited' })
  async login(
    @Body(new ZodValidationPipe(GoogleIdTokenDtoSchema)) dto: GoogleIdTokenDto,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.googleAuth.login({
      idToken: dto.idToken,
      ip,
      userAgent: req.headers['user-agent'],
      fingerprint: (req.headers['x-device-fingerprint'] as string | undefined),
      platform: (req.headers['x-device-platform'] as 'ANDROID' | 'IOS' | undefined),
    });
  }

  @UseGuards(JwtAuthGuard)
  @SkipOnboarding()
  @SkipTenant()
  @Post('link')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Link a Google account to the current user (JWT required)' })
  @ApiResponse({ status: 200, description: 'Google account linked' })
  @ApiResponse({ status: 401, description: 'Invalid or unverified Google token' })
  @ApiResponse({ status: 409, description: 'Google account already linked to another user' })
  async link(
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(GoogleIdTokenDtoSchema)) dto: GoogleIdTokenDto,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.googleAuth.link(user.id, {
      idToken: dto.idToken,
      ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @UseGuards(JwtAuthGuard)
  @SkipOnboarding()
  @SkipTenant()
  @Post('unlink')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Unlink the Google account from the current user (JWT required)' })
  @ApiResponse({ status: 204, description: 'Google account unlinked' })
  async unlink(
    @CurrentUser() user: { id: string },
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    await this.googleAuth.unlink(user.id, {
      ip,
      userAgent: req.headers['user-agent'],
    });
    return;
  }
}
