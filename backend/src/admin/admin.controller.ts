// ============================================================
// Yene Verify — Admin Controller
// POST /api/v1/admin/auth/google/login
// GET  /api/v1/admin/health
// GET  /api/v1/admin/users
// ============================================================

import {
  Body,
  Controller,
  Get,
  Post,
  Ip,
  Req,
  Query,
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
  search: z.string().optional(),
});
type ListUsersDto = z.infer<typeof ListUsersDtoSchema>;

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
}
