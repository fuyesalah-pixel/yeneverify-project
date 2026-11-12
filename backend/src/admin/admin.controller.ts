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
// POST /api/v1/admin/notifications/send
// GET  /api/v1/admin/notifications/audience
// GET  /api/v1/admin/notifications/history
// GET  /api/v1/admin/notifications/history/:id
// GET  /api/v1/admin/verifications/review-queue
// GET  /api/v1/admin/verifications/:id
// GET  /api/v1/admin/verifications/:id/receipt
// POST /api/v1/admin/verifications/:id/review
// ============================================================

import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Ip,
  Req,
  Res,
  Query,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import type { Request, Response } from 'express';
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

const SendNotificationDtoSchema = z
  .object({
    targetType: z.enum(['ALL', 'ROLE', 'USER']),
    role: z.enum(['MERCHANT', 'SUB_MERCHANT']).optional(),
    userId: z.string().uuid('userId must be a UUID.').optional(),
    title: z.string().trim().min(3, 'A title of at least 3 characters is required.').max(120),
    body: z.string().trim().min(3, 'A message of at least 3 characters is required.').max(1000),
    type: z.enum(['info', 'warning', 'system']),
  })
  .superRefine((value, ctx) => {
    if (value.targetType === 'ROLE' && !value.role) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['role'],
        message: 'A role is required when targeting a role.',
      });
    }
    if (value.targetType === 'USER' && !value.userId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['userId'],
        message: 'A user is required when targeting an individual.',
      });
    }
  });
type SendNotificationDto = z.infer<typeof SendNotificationDtoSchema>;

const NotificationHistoryDtoSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).optional().default(20),
});
type NotificationHistoryDto = z.infer<typeof NotificationHistoryDtoSchema>;

const ReviewQueueDtoSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).optional().default(20),
  search: z.string().optional(),
});
type ReviewQueueDto = z.infer<typeof ReviewQueueDtoSchema>;

const ReviewDecisionDtoSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  note: z
    .string()
    .trim()
    .min(3, 'A note of at least 3 characters is required for every review decision.')
    .max(500),
});
type ReviewDecisionDto = z.infer<typeof ReviewDecisionDtoSchema>;

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
  async getUser(@Param('id', new ParseUUIDPipe()) id: string) {
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
    @Param('id', new ParseUUIDPipe()) id: string,
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
    @Param('id', new ParseUUIDPipe()) id: string,
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
    @Param('id', new ParseUUIDPipe()) id: string,
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
    @Param('id', new ParseUUIDPipe()) id: string,
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
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('deviceId', new ParseUUIDPipe()) deviceId: string,
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

  // ── Broadcast notifications ─────────────────────────────────────────────

  /** Recipient counts for the compose form's target selector. */
  @UseGuards(JwtAuthGuard)
  @AdminOnly()
  @Get('notifications/audience')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Broadcast audience counts (admin only)' })
  @ApiResponse({ status: 200, description: 'Active recipients by target' })
  async getNotificationAudience() {
    return this.admin.getNotificationAudience();
  }

  /** Send one notification to all merchants, a role, or one user. */
  @UseGuards(JwtAuthGuard)
  @AdminOnly()
  @Post('notifications/send')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Send a broadcast notification (admin only)' })
  @ApiResponse({ status: 200, description: 'Campaign written and fanned out' })
  @ApiResponse({ status: 400, description: 'Invalid target or no matching recipients' })
  @ApiResponse({ status: 404, description: 'Target user not found' })
  async sendNotification(
    @CurrentUser() admin: AuthUser,
    @Body(new ZodValidationPipe(SendNotificationDtoSchema)) dto: SendNotificationDto,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.admin.sendNotification({
      targetType: dto.targetType,
      role: dto.role,
      userId: dto.userId,
      title: dto.title,
      body: dto.body,
      type: dto.type,
      actorUserId: admin.id,
      ip,
      userAgent: req.headers['user-agent'],
    });
  }

  /** Campaign history with live delivery counts. */
  @UseGuards(JwtAuthGuard)
  @AdminOnly()
  @Get('notifications/history')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Broadcast history (admin only)' })
  @ApiResponse({ status: 200, description: 'Paginated campaign history' })
  async getNotificationHistory(
    @Query(new ZodValidationPipe(NotificationHistoryDtoSchema)) dto: NotificationHistoryDto,
  ) {
    return this.admin.getNotificationHistory(dto);
  }

  /** One campaign with its per-recipient delivery breakdown. */
  @UseGuards(JwtAuthGuard)
  @AdminOnly()
  @Get('notifications/history/:id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Broadcast detail and delivery stats (admin only)' })
  @ApiResponse({ status: 200, description: 'Campaign and recipient delivery rows' })
  @ApiResponse({ status: 404, description: 'Campaign not found' })
  async getNotificationDetail(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.admin.getNotificationDetail(id);
  }

  // ── Review queue ────────────────────────────────────────────────────────

  /** NEEDS_REVIEW transaction verifications awaiting an admin decision. */
  @UseGuards(JwtAuthGuard)
  @AdminOnly()
  @Get('verifications/review-queue')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Verification review queue (admin only)' })
  @ApiResponse({ status: 200, description: 'Paginated NEEDS_REVIEW verifications' })
  async getReviewQueue(
    @Query(new ZodValidationPipe(ReviewQueueDtoSchema)) dto: ReviewQueueDto,
  ) {
    return this.admin.getReviewQueue(dto);
  }

  /** Full evidence for one verification: OCR text, adapter result, receipt. */
  @UseGuards(JwtAuthGuard)
  @AdminOnly()
  @Get('verifications/:id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Verification review detail (admin only)' })
  @ApiResponse({ status: 200, description: 'Verification, receipt metadata, OCR and adapter output' })
  @ApiResponse({ status: 404, description: 'Verification not found' })
  async getReviewDetail(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.admin.getReviewDetail(id);
  }

  /**
   * Receipt image bytes. Binary response — uses @Res() directly so the
   * global { success, data } envelope never wraps the stream.
   */
  @UseGuards(JwtAuthGuard)
  @AdminOnly()
  @Get('verifications/:id/receipt')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Receipt image for a verification (admin only)' })
  @ApiResponse({ status: 200, description: 'Receipt image bytes' })
  @ApiResponse({ status: 404, description: 'No stored receipt image' })
  async getReceipt(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const { body, mimeType } = await this.admin.getVerificationReceipt(id);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', String(body.byteLength));
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('Content-Disposition', 'inline');
    res.end(body);
  }

  /** Approve as VERIFIED or reject as FAKE. A note is always required. */
  @UseGuards(JwtAuthGuard)
  @AdminOnly()
  @Post('verifications/:id/review')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Resolve a verification review (admin only)' })
  @ApiResponse({ status: 200, description: 'Verification resolved and audited' })
  @ApiResponse({ status: 400, description: 'Billing verification or missing note' })
  @ApiResponse({ status: 409, description: 'Verification is no longer in the review queue' })
  async reviewVerification(
    @CurrentUser() admin: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(ReviewDecisionDtoSchema)) dto: ReviewDecisionDto,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    return this.admin.reviewVerification({
      verificationId: id,
      decision: dto.decision,
      note: dto.note,
      actorUserId: admin.id,
      ip,
      userAgent: req.headers['user-agent'],
    });
  }
}
