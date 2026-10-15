// ============================================================
// Yene Verify — Auth Controller
// REST endpoints for authentication.
// ============================================================

import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Param,
  Body,
  Req,
  Ip,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequireStepUp } from './step-up';
import { RequestOtpDto, VerifyOtpDto, RefreshTokenDto, LogoutDto, UpdateLanguageDto } from './dto';
import { SetPinDto } from './pin/dto/set-pin.dto';
import { VerifyPinDto } from './pin/dto/verify-pin.dto';
import { ChangePinDto } from './pin/dto/change-pin.dto';
import { ResetPinDto } from './pin/dto/reset-pin.dto';
import { EnableBiometricDto, DisableBiometricDto } from './biometric/dto';
import { BiometricStepUpDto } from './step-up/dto';

@ApiTags('Auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('request-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request OTP for phone verification' })
  @ApiResponse({ status: 200, description: 'OTP sent successfully' })
  @ApiResponse({ status: 429, description: 'Rate limited' })
  async requestOtp(@Body() dto: RequestOtpDto, @Req() req: Request, @Ip() ip: string) {
    return this.auth.requestOtp(dto.phone, dto.purpose, ip, req.headers['user-agent']);
  }

  @Public()
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify OTP and get tokens' })
  @ApiResponse({ status: 200, description: 'Tokens issued' })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  @ApiResponse({ status: 429, description: 'Rate limited or locked out' })
  async verifyOtp(@Body() dto: VerifyOtpDto, @Req() req: Request, @Ip() ip: string) {
    return this.auth.verifyOtp(dto.phone, dto.code, dto.purpose, ip, req.headers['user-agent'], {
      fingerprint: dto.device.fingerprint,
      platform: dto.device.platform,
      model: dto.device.model,
      osVersion: dto.device.osVersion,
      appVersion: dto.device.appVersion,
      pushToken: dto.device.pushToken,
    });
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'New tokens issued' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(@Body() dto: RefreshTokenDto, @Ip() ip: string) {
    return this.auth.refresh(dto.refreshToken, ip);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Logout current session' })
  @ApiResponse({ status: 204, description: 'Logged out' })
  async logout(@CurrentUser() user: { id: string }, @Body() dto: LogoutDto, @Ip() ip: string) {
    await this.auth.logout(user.id, dto.refreshToken, ip);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Logout all sessions' })
  @ApiResponse({ status: 204, description: 'All sessions revoked' })
  async logoutAll(@CurrentUser() user: { id: string }, @Ip() ip: string) {
    await this.auth.logoutAll(user.id, ip);
  }

  @UseGuards(JwtAuthGuard)
  @Get('devices')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List active devices' })
  @ApiResponse({ status: 200, description: 'List of active devices' })
  async listDevices(@CurrentUser() user: { id: string }) {
    return this.auth.listDevices(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('devices/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Revoke a device' })
  @ApiResponse({ status: 204, description: 'Device revoked' })
  async revokeDevice(@CurrentUser() user: { id: string }, @Param('id') deviceId: string) {
    await this.auth.revokeDevice(user.id, deviceId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Current user profile' })
  async me(@CurrentUser() user: { id: string }) {
    return this.auth.getMe(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('/me/language')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update preferred language' })
  @ApiResponse({ status: 200, description: 'Language updated' })
  async updateLanguage(@CurrentUser() user: { id: string }, @Body() dto: UpdateLanguageDto) {
    await this.auth.updateLanguage(user.id, dto.language);
    return { ok: true };
  }

  // ============================================================
  // PIN endpoints (Step 11)
  // ============================================================

  @UseGuards(JwtAuthGuard)
  @Post('pin/set')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Set PIN (first time)' })
  @ApiResponse({ status: 200, description: 'PIN set successfully' })
  @ApiResponse({ status: 400, description: 'PIN already set or weak PIN' })
  @ApiResponse({ status: 429, description: 'Rate limited or token too old' })
  async setPin(
    @CurrentUser() user: { id: string },
    @Body() dto: SetPinDto,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    // Check if access token is fresh (less than 5 min old)
    // If not, require OTP code in dto.otpCode
    return this.auth.setPin(user.id, dto.pin, ip, req.headers['user-agent'], dto.otpCode);
  }

  @UseGuards(JwtAuthGuard)
  @Post('pin/verify')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Verify PIN (returns step-up token)' })
  @ApiResponse({ status: 200, description: 'Step-up token issued' })
  @ApiResponse({ status: 400, description: 'Invalid or expired PIN' })
  @ApiResponse({ status: 429, description: 'Locked out' })
  async verifyPin(
    @CurrentUser() user: { id: string },
    @Body() dto: VerifyPinDto,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    const result = await this.auth.verifyPin(user.id, dto.pin, ip, req.headers['user-agent']);
    return { stepUpToken: result.stepUpToken, expiresIn: result.expiresIn };
  }

  @UseGuards(JwtAuthGuard)
  @RequireStepUp()
  @Post('pin/change')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiHeader({
    name: 'X-Step-Up-Token',
    description: 'Step-up token from PIN verify or biometric step-up',
  })
  @ApiOperation({ summary: 'Change PIN (requires step-up)' })
  @ApiResponse({ status: 200, description: 'PIN changed, other sessions revoked' })
  @ApiResponse({ status: 401, description: 'Invalid current PIN or missing step-up' })
  async changePin(
    @CurrentUser() user: { id: string },
    @Body() dto: ChangePinDto,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    return this.auth.changePin(user.id, dto.currentPin, dto.newPin, ip, req.headers['user-agent']);
  }

  @Public()
  @Post('pin/reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset PIN via OTP (forgot PIN)' })
  @ApiResponse({ status: 200, description: 'PIN reset, all sessions revoked' })
  @ApiResponse({ status: 400, description: 'Invalid OTP' })
  async resetPin(@Body() dto: ResetPinDto, @Req() req: Request, @Ip() ip: string) {
    return this.auth.resetPin(dto.phone, dto.otpCode, ip, req.headers['user-agent'], dto.device);
  }

  // ============================================================
  // Biometric endpoints (Step 11)
  // ============================================================

  @UseGuards(JwtAuthGuard)
  @RequireStepUp()
  @Post('biometric/enable')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiHeader({ name: 'X-Step-Up-Token', description: 'Step-up token from PIN verify' })
  @ApiOperation({ summary: 'Enable biometric unlock for a device' })
  @ApiResponse({ status: 200, description: 'Biometric enabled' })
  @ApiResponse({ status: 401, description: 'Missing or invalid step-up token' })
  async enableBiometric(
    @CurrentUser() user: { id: string },
    @Body() dto: EnableBiometricDto,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    return this.auth.enableBiometric(user.id, dto.deviceId, ip, req.headers['user-agent']);
  }

  @UseGuards(JwtAuthGuard)
  @RequireStepUp()
  @Post('biometric/disable')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiHeader({ name: 'X-Step-Up-Token', description: 'Step-up token from PIN verify' })
  @ApiOperation({ summary: 'Disable biometric unlock for a device' })
  @ApiResponse({ status: 200, description: 'Biometric disabled' })
  @ApiResponse({ status: 401, description: 'Missing or invalid step-up token' })
  async disableBiometric(
    @CurrentUser() user: { id: string },
    @Body() dto: DisableBiometricDto,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    return this.auth.disableBiometric(user.id, dto.deviceId, ip, req.headers['user-agent']);
  }

  // ============================================================
  // Step-Up endpoints (Step 11)
  // ============================================================

  @Public()
  @Post('step-up/biometric')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get step-up token after biometric unlock' })
  @ApiResponse({ status: 200, description: 'Step-up token issued' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token or device mismatch' })
  async biometricStepUp(@Body() dto: BiometricStepUpDto, @Ip() ip: string) {
    return this.auth.biometricStepUp(
      dto.refreshToken,
      dto.device.fingerprint,
      dto.device.platform,
      dto.device.model,
      dto.device.osVersion,
      dto.device.appVersion,
      dto.device.pushToken,
      ip,
    );
  }

  // ============================================================
  // Unlock endpoint (Step 11) - replaces /auth/refresh on app open
  // ============================================================

  @Public()
  @Post('unlock')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unlock session (refresh + device verification)' })
  @ApiResponse({ status: 200, description: 'New tokens issued' })
  @ApiResponse({ status: 401, description: 'Invalid token, device mismatch, or no PIN' })
  async unlock(
    @Body() dto: RefreshTokenDto,
    @Body('device') device: { fingerprint: string; platform: 'ANDROID' | 'IOS' },
    @Body('unlockMethod') unlockMethod: 'BIOMETRIC' | 'PIN',
    @Ip() ip: string,
  ) {
    // We need to add the device info to the refresh token DTO or create a new one
    // For now, we'll extend the RefreshTokenDto to include device info
    return this.auth.unlock(
      dto.refreshToken,
      device.fingerprint,
      device.platform,
      unlockMethod,
      ip,
    );
  }
}
