// ============================================================
// Yene Verify — Exports Module (Step 19)
//
// Owns the merchant export surface:
//
//   ExportsController/Service — POST create + status/detail/list
//   ExportsProcessor       — BullMQ worker (EXPORT queue)
//   ExportsExpiryJob       — daily MAINTENANCE job (04:00 Addis)
//   CsvFormatter/PdfFormatter — pure formatting functions
//
// NotificationsModule is imported for the completion notification
// (SYSTEM row through the single notify() choke point). Export and
// MAINTENANCE queues are registered globally by QueueModule.
// ============================================================

import { Module } from '@nestjs/common';
import { ExportsController } from './exports.controller';
import { ExportsService } from './exports.service';
import { ExportsRepository } from './exports.repository';
import { ExportsProcessor } from './exports.processor';
import { ExportsExpiryJob } from './jobs/exports-expiry.job';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [ExportsController],
  providers: [ExportsRepository, ExportsService, ExportsProcessor, ExportsExpiryJob],
})
export class ExportsModule {}
