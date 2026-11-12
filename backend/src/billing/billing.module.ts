// ============================================================
// Yene Verify — Billing Module (Step 16)
//
// The money-in loop endpoints + the post-verdict state machine the
// verification processor calls. Dependencies:
//   CreditsModule (grant on approval), NotificationsModule (notify()),
//   AuditModule (append-only trail), VerificationModule's global queue.
// Contains no bank adapter or OCR logic — the engine is reused as-is
// with source=BILLING.
// ============================================================

import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CreditsModule } from '../credits/credits.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PlatformConfigModule } from '../platform-config/platform-config.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { BillingRepository } from './billing.repository';

@Module({
  imports: [AuditModule, CreditsModule, NotificationsModule, PlatformConfigModule],
  controllers: [BillingController],
  providers: [BillingService, BillingRepository],
  exports: [BillingService],
})
export class BillingModule {}
