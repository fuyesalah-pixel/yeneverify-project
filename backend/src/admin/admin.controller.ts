// ============================================================
// Yene Verify — Admin Controller
// POST /api/v1/admin/auth/google/login
// GET  /api/v1/admin/health
// GET  /api/v1/admin/users
// GET  /api/v1/admin/users/:id
// PATCH /api/v1/admin/users/:id/status
// PATCH /api/v1/admin/users/:id/role
// POST /api/v1/admin/users/:id/credits
// POST /api/v1/admin/users/:id/pin/reset
// POST /api/v1/admin/users/:id/devices/:deviceId/revoke
// GET  /api/v1/admin/merchants
// GET  /api/v1/admin/credits/overview
// GET  /api/v1/admin/credits/merchants
// POST /api/v1/admin/credits/adjustments
// ============================================================

import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Ip,
  Req,
  Query,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { z } from 'zod';
import { Public } from '../common/decorators/public.decorator';
import { SkipOnboarding } from '../common/decorators/skip-onboarding.decorator';
import { SkipTenant } from '../common/decorators/skip-tenant.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthUser } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AdminOnly } from '../common/decorators/admin-only.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AdminService } from './admin.service';

const GoogleIdTokenDtoSchema = z.object({
  idToken: z.string().min(1, 'ID token is required.'),
});
type GoogleIdTokenDto = z.infer<typeof GoogleIdTokenDtoSchema>;

const ListUsersDtoSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  role: z.enum(['ADMIN', 'MERCHANT', 'SUB_MERCHANT']).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'BANNED', 'DELETED']).optional(),
  package: z.enum(['FREE', 'PREMIUM', 'BUSINESS', 'BUSINESS_PRO', 'API']).optional(),
  search: z.string().optional(),
});
type ListUsersDto = z.infer<typeof ListUsersDtoSchema>;

const ListMerchantsDtoSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).optional().default(10),
  search: z.string().optional(),
});
type ListMerchantsDto = z.infer<typeof ListMerchantsDtoSchema>;

const SetUserStatusDtoSchema = z.object({
  action: z.enum(['SUSPEND', 'BAN', 'REACTIVATE']),
  reason: z.string().max(500).optional(),
});
type SetUserStatusDto = z.infer<typeof SetUserStatusDtoSchema>;

const ChangeUserRoleDtoSchema = z.object({
  role: z.enum(['MERCHANT', 'SUB_MERCHANT']),
  reason: z.string().max(500).optional(),
});
type ChangeUserRoleDto = z.infer<typeof ChangeUserRoleDtoSchema>;

const UserCreditsDtoSchema = z.object({
  // Signed like the merchant adjustment: positive grants, negative removes.
  amount: z.coerce.number().int().min(-1_000_000).max(1_000_000).refine((n) => n !== 0, {
    message: 'Amount cannot be zero.',
  }),
  reason: z.string().trim().min(3, 'A reason of at least 3 characters is required.').max(500),
});
type UserCreditsDto = z.infer<typeof UserCreditsDtoSchema>;

const CreditMerchantsDtoSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).optional().default(20),
  search: z.string().optional(),
});
type CreditMerchantsDto = z.infer<typeof CreditMerchantsDtoSchema>;

const AdjustCreditsDtoSchema = z.object({
  merchantId: z.string().uuid('merchantId must be a UUID.'),
  // Signed: positive adds credits, negative removes them. Bounded so a
  // mistyped amount cannot mint or drain an implausible quantity at once.
  amount: z.coerce.number().int().min(-1_000_000).max(1_000_000).refine((n) => n !== 0, {
    message: 'Amount cannot be zero.',
  }),
  reason: z.string().trim().min(3, 'A reason of at least 3 characters is required.').max(500),
});
type AdjustCreditsDto = z.infer<typeof AdjustCreditsDtoSchema>;

@ApiTags('Admin')
@Controller({ path: 'admin', version: '1' })
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  /**
   * Admin Google Sign-In. Verifies the ID token, checks the email allowlist,
   * creates/links the admin user, and issues session tokens.
   */
  @Public()
  @SkipOnboarding()
  @SkipTenant()
  @Post('auth/google/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin Google Sign-In (email allowlist enforced)' })
  @ApiResponse({ status: 200, description: 'Admin tokens issued' })
  @ApiResponse({ status: 401, description: 'Invalid token or not authorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — not an admin email' })
  async adminGoogleLogin(
    @Body(new ZodValidationPipe(GoogleIdTokenDtoSchema)) dto: GoogleIdTokenDto,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.admin.googleLogin({
      idToken: dto.idToken,
      ip,
      userAgent: req.headers['user-agent'],
    });
  }

  /**
   * System health check (admin only).
   */
  @UseGuards(JwtAuthGuard)
  @AdminOnly()
  @Get('health')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'System health check' })
  @ApiResponse({ status: 200, description: 'Health status' })
  async getHealth() {
    return this.admin.getHealth();
  }

  /**
   * List users with filters and pagination (admin only).
   */
  @UseGuards(JwtAuthGuard)
  @AdminOnly()
  @Get('users')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List users (admin only)' })
  @ApiResponse({ status: 200, description: 'Paginated user list' })
  async getUsers(@Query(new ZodValidationPipe(ListUsersDtoSchema)) dto: ListUsersDto) {
    return this.admin.getUsers(dto);
  }

  /**
   * One user with tenant, subscription, credit position and recent activity.
   */
  @UseGuards(JwtAuthGuard)
  @AdminOnly()
  @Get('users/:id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'User detail (admin only)' })
  @ApiResponse({ status: 200, description: 'User profile, subscription, credits, activity' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUser(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.admin.getUserDetail(id);
  }

  /** Suspend, ban, or reactivate a user (and their merchant). */
  @UseGuards(JwtAuthGuard)
  @AdminOnly()
  @Patch('users/:id/status')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Change user status (admin only)' })
  @ApiResponse({ status: 200, description: 'Status updated' })
  @ApiResponse({ status: 403, description: 'Admin accounts cannot be changed here' })
  async setUserStatus(
    @CurrentUser() admin: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new ZodValidationPipe(SetUserStatusDtoSchema)) dto: SetUserStatusDto,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.admin.setUserStatus({
      userId: id,
      action: dto.action,
      reason: dto.reason,
      actorUserId: admin.id,
      ip,
      userAgent: req.headers['user-agent'],
    });
  }

  /** Change a user's role between merchant and sub-merchant. */
  @UseGuards(JwtAuthGuard)
  @AdminOnly()
  @Patch('users/:id/role')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Change user role (admin only)' })
  @ApiResponse({ status: 200, description: 'Role updated' })
  @ApiResponse({ status: 400, description: 'Missing merchant or sub-merchant membership' })
  @ApiResponse({ status: 403, description: 'Admin roles are managed separately' })
  async changeUserRole(
    @CurrentUser() admin: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new ZodValidationPipe(ChangeUserRoleDtoSchema)) dto: ChangeUserRoleDto,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.admin.changeUserRole({
      userId: id,
      role: dto.role,
      reason: dto.reason,
      actorUserId: admin.id,
      ip,
      userAgent: req.headers['user-agent'],
    });
  }

  /**
   * Adjust credits for the merchant behind a user (owner or sub-merchant).
   * Same signed ledger write as POST /credits/adjustments.
   */
  @UseGuards(JwtAuthGuard)
  @AdminOnly()
  @Post('users/:id/credits')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Adjust a user merchant credits (admin only)' })
  @ApiResponse({ status: 200, description: 'Adjustment written to the ledger and audited' })
  @ApiResponse({ status: 400, description: 'Zero amount, missing reason, or no merchant account' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async adjustUserCredits(
    @CurrentUser() admin: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new ZodValidationPipe(UserCreditsDtoSchema)) dto: UserCreditsDto,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.admin.adjustUserCredits({
      userId: id,
      amount: BigInt(dto.amount),
      reason: dto.reason,
      actorUserId: admin.id,
      ip,
      userAgent: req.headers['user-agent'],
    });
  }

  /** Clear a user's PIN and revoke their sessions. */
  @UseGuards(JwtAuthGuard)
  @AdminOnly()
  @Post('users/:id/pin/reset')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Reset a user PIN (admin only)' })
  @ApiResponse({ status: 200, description: 'PIN cleared, sessions revoked' })
  async resetUserPin(
    @CurrentUser() admin: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.admin.resetUserPin({
      userId: id,
      actorUserId: admin.id,
      ip,
      userAgent: req.headers['user-agent'],
    });
  }

  /** Revoke one trusted device. */
  @UseGuards(JwtAuthGuard)
  @AdminOnly()
  @Post('users/:id/devices/:deviceId/revoke')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Revoke a user device (admin only)' })
  @ApiResponse({ status: 200, description: 'Device revoked' })
  @ApiResponse({ status: 404, description: 'Device not found for this user' })
  async revokeUserDevice(
    @CurrentUser() admin: AuthUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('deviceId', new ParseUUIDPipe({ version: '4' })) deviceId: string,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.admin.revokeUserDevice({
      userId: id,
      deviceId,
      actorUserId: admin.id,
      ip,
      userAgent: req.headers['user-agent'],
    });
  }

  /** Merchant lookup used by the manual credit adjustment flow. */
  @UseGuards(JwtAuthGuard)
  @AdminOnly()
  @Get('merchants')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Search merchants (admin only)' })
  @ApiResponse({ status: 200, description: 'Paginated merchant list' })
  async getMerchants(@Query(new ZodValidationPipe(ListMerchantsDtoSchema)) dto: ListMerchantsDto) {
    return this.admin.listMerchants(dto);
  }

  /** Platform credit totals, 30-day series, top consumers, low balances. */
  @UseGuards(JwtAuthGuard)
  @AdminOnly()
  @Get('credits/overview')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Credits overview (admin only)' })
  @ApiResponse({ status: 200, description: 'Credit dashboard data' })
  async getCreditsOverview() {
    return this.admin.getCreditsOverview();
  }

  /** Per-merchant credit usage: balance, 30-day consumption, last top-up. */
  @UseGuards(JwtAuthGuard)
  @AdminOnly()
  @Get('credits/merchants')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Per-merchant credit usage (admin only)' })
  @ApiResponse({ status: 200, description: 'Paginated merchant credit usage' })
  async getCreditMerchants(
    @Query(new ZodValidationPipe(CreditMerchantsDtoSchema)) dto: CreditMerchantsDto,
  ) {
    return this.admin.getMerchantCreditStats(dto);
  }

  /** Manual credit adjustment (positive adds, negative removes). */
  @UseGuards(JwtAuthGuard)
  @AdminOnly()
  @Post('credits/adjustments')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Adjust merchant credits (admin only)' })
  @ApiResponse({ status: 200, description: 'Adjustment written to the ledger and audited' })
  @ApiResponse({ status: 400, description: 'Zero amount or missing reason' })
  @ApiResponse({ status: 404, description: 'Merchant not found' })
  async adjustCredits(
    @CurrentUser() admin: AuthUser,
    @Body(new ZodValidationPipe(AdjustCreditsDtoSchema)) dto: AdjustCreditsDto,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.admin.adjustCredits({
      merchantId: dto.merchantId,
      amount: BigInt(dto.amount),
      reason: dto.reason,
      actorUserId: admin.id,
      ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
