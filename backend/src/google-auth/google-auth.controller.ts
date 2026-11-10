// ============================================================
// Yene Verify â€” Google Auth Controller
// POST /api/v1/auth/google | /auth/google/link | /auth/google/unlink
// POST /api/v1/auth/google/onboard | /auth/google/signin
// GET /api/v1/auth/device-accounts
// POST /api/v1/auth/device-accounts/:phoneLast4/signout
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
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { SkipOnboarding } from '../common/decorators/skip-onboarding.decorator';
import { SkipTenant } from '../common/decorators/skip-tenant.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GoogleIdTokenDtoSchema, type GoogleIdTokenDto } from './dto/google-auth.dto';
import {
  GoogleOnboardDtoSchema,
  type GoogleOnboardDto,
  GoogleSigninDtoSchema,
  type GoogleSigninDto,
  DeviceAccountsDtoSchema,
  type DeviceAccountsDto,
  DeviceSignoutDtoSchema,
  type DeviceSignoutDto,
} from './dto/google-auth.dto';
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
      fingerprint: req.headers['x-device-fingerprint'] as string | undefined,
      platform: req.headers['x-device-platform'] as 'ANDROID' | 'IOS' | undefined,
    });
  }

  /**
   * First-time Google signup + phone pairing.
   */
  @Public()
  @SkipOnboarding()
  @SkipTenant()
  @Post('onboard')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'First-time Google signup: verify ID token, pair phone, issue tokens',
  })
  @ApiResponse({ status: 201, description: 'User created and tokens issued' })
  @ApiResponse({ status: 400, description: 'Invalid phone format' })
  @ApiResponse({ status: 401, description: 'Invalid or unverified Google token' })
  @ApiResponse({ status: 403, description: 'Device limit reached (2 accounts max)' })
  @ApiResponse({ status: 409, description: 'Phone or Google already paired' })
  @ApiResponse({ status: 429, description: 'Rate limited' })
  async onboard(
    @Body(new ZodValidationPipe(GoogleOnboardDtoSchema)) dto: GoogleOnboardDto,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.googleAuth.onboard({
      idToken: dto.idToken,
      phone: dto.phone,
      fullName: dto.fullName,
      device: dto.device,
      ip,
      userAgent: req.headers['user-agent'],
    });
  }

  /**
   * Returning Google user sign-in with device limit check.
   */
  @Public()
  @SkipOnboarding()
  @SkipTenant()
  @Post('signin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Returning Google user sign-in' })
  @ApiResponse({ status: 200, description: 'Access + refresh tokens issued' })
  @ApiResponse({ status: 401, description: 'Invalid or unverified Google token' })
  @ApiResponse({ status: 403, description: 'Device limit reached or account banned' })
  @ApiResponse({ status: 403, description: 'Google account not linked' })
  @ApiResponse({ status: 429, description: 'Rate limited' })
  async signin(
    @Body(new ZodValidationPipe(GoogleSigninDtoSchema)) dto: GoogleSigninDto,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.googleAuth.signin({
      idToken: dto.idToken,
      device: dto.device,
      ip,
      userAgent: req.headers['user-agent'],
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
  async unlink(@CurrentUser() user: { id: string }, @Ip() ip: string, @Req() req: Request) {
    await this.googleAuth.unlink(user.id, {
      ip,
      userAgent: req.headers['user-agent'],
    });
    return;
  }

  // ── Device accounts (public, pre-sign-in) ──────────────────────────────

  @Public()
  @SkipOnboarding()
  @SkipTenant()
  @Post('device-accounts')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List accounts paired to a device fingerprint' })
  @ApiResponse({ status: 200, description: 'Paired accounts on this device' })
  async deviceAccounts(
    @Body(new ZodValidationPipe(DeviceAccountsDtoSchema)) dto: DeviceAccountsDto,
  ) {
    return this.googleAuth.getDeviceAccounts(dto.deviceFingerprint);
  }

  @Public()
  @SkipOnboarding()
  @SkipTenant()
  @Post('device-accounts/:phoneLast4/signout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove a device binding for a specific account (by phone last-4)',
  })
  @ApiResponse({ status: 204, description: 'Device binding removed' })
  async deviceSignout(
    @Param('phoneLast4') phoneLast4: string,
    @Body(new ZodValidationPipe(DeviceSignoutDtoSchema)) dto: DeviceSignoutDto,
  ) {
    await this.googleAuth.signoutDeviceAccount({
      phoneLast4,
      deviceFingerprint: dto.deviceFingerprint,
    });
    return;
  }
}
