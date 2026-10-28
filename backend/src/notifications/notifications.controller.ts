// ============================================================
// Yene Verify — Notifications Controller (Step 15)
//
// The in-app inbox for the mobile client:
//   GET    /api/v1/notifications           list (200, paginated, meta.unreadCount)
//   GET    /api/v1/notifications/unread-count   badge count
//   POST   /api/v1/notifications/:id/read  mark one read (204)
//   POST   /api/v1/notifications/read-all  mark all read (200)
//
// Scoping: strictly per-USER (notification.userId === caller id)
// — a sub-merchant sees their own inbox, not the owner's. There
// is deliberately no @Roles() restriction: after JwtAuthGuard
// every authenticated role may read its OWN inbox.
// ============================================================

import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ListNotificationsQuerySchema } from './dto/list-notifications.query';
import type { ListNotificationsQuery } from './dto/list-notifications.query';
import type {
  NotificationDto,
  NotificationListResponseDto,
  MarkAllReadResponseDto,
  UnreadCountResponseDto,
} from './dto/notification-response.dto';
import type { AuthUser } from '../common/types/auth-user.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { NotificationRow } from './notifications.repository';

@ApiTags('Notifications')
@Controller({ path: 'notifications', version: '1' })
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  // ── GET /notifications ────────────────────────────────────────────────
  @Get()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List my notifications (newest first, paginated)' })
  async list(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(ListNotificationsQuerySchema))
    query: ListNotificationsQuery,
  ): Promise<NotificationListResponseDto> {
    const [{ rows, total }, unreadCount] = await Promise.all([
      this.service.list(user.id, {
        page: query.page,
        pageSize: query.pageSize,
        unreadOnly: query.unreadOnly,
        types: query.type,
      }),
      this.service.unreadCount(user.id),
    ]);
    return {
      data: rows.map(toDto),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
        unreadCount,
      },
    };
  }

  // ── GET /notifications/unread-count ───────────────────────────────────
  @Get('unread-count')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Unread count (badge) for my inbox' })
  async unreadCount(@CurrentUser() user: AuthUser): Promise<UnreadCountResponseDto> {
    return { count: await this.service.unreadCount(user.id) };
  }

  // ── POST /notifications/:id/read ──────────────────────────────────────
  @Post(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Mark one of MY notifications as read' })
  async markRead(
    @CurrentUser() user: AuthUser,
    @Param('id') notificationId: string,
  ): Promise<void> {
    await this.service.markRead(user.id, notificationId);
  }

  // ── POST /notifications/read-all ──────────────────────────────────────
  @Post('read-all')
  @HttpCode(HttpStatus.OK) // mutation returning a count, not a new resource
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Mark ALL my unread notifications as read' })
  async markAllRead(@CurrentUser() user: AuthUser): Promise<MarkAllReadResponseDto> {
    return { markedCount: await this.service.markAllRead(user.id) };
  }
}

/** bigint-free, Date→ISO: everything here is JSON-safe by construction. */
function toDto(row: NotificationRow): NotificationDto {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    data: (row.data as Record<string, unknown> | null) ?? null,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    pushedAt: row.pushedAt ? row.pushedAt.toISOString() : null,
    pushError: row.pushError,
    createdAt: row.createdAt.toISOString(),
  };
}
