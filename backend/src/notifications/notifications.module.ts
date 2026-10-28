// ============================================================
// Yene Verify — Notifications Module (14.3 Part C)
// Persistence-only. FCM push delivery is Step 15.
// ============================================================

import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Module({
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
