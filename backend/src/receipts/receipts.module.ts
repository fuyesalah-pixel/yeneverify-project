// ============================================================
// Yene Verify — Receipts Module
// ============================================================

import { Module } from '@nestjs/common';
import { ReceiptsController } from './receipts.controller';
import { InternalStorageController } from './internal-storage.controller';
import { ReceiptsService } from './receipts.service';
import { ReceiptsRepository } from './receipts.repository';
import { AuditModule } from '../audit/audit.module';
import { OcrModule } from '../ocr/ocr.module';

@Module({
  imports: [AuditModule, OcrModule],
  controllers: [ReceiptsController, InternalStorageController],
  providers: [ReceiptsService, ReceiptsRepository],
  exports: [ReceiptsService, ReceiptsRepository],
})
export class ReceiptsModule {}
