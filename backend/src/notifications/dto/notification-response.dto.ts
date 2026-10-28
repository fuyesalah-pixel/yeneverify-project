// ============================================================
// Yene Verify — Notification response DTOs (Step 15)
// ============================================================

export interface NotificationDto {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  readAt: string | null;
  pushedAt: string | null;
  pushError: string | null;
  createdAt: string;
}

export interface NotificationListMetaDto {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  unreadCount: number;
}

export interface NotificationListResponseDto {
  data: NotificationDto[];
  meta: NotificationListMetaDto;
}

export interface UnreadCountResponseDto {
  count: number;
}

export interface MarkAllReadResponseDto {
  markedCount: number;
}
