// ============================================================
// Yene Verify — Analytics Module (Step 18)
//
// Read-only insight endpoints. Depends only on the global
// PrismaModule: no notifications, no credits, no queue coupling —
// analytics never mutates anything.
// ============================================================

import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsRepository } from './analytics.repository';

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsRepository],
})
export class AnalyticsModule {}
