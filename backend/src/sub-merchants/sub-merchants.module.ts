// ============================================================
// Yene Verify — Sub-Merchants Module
// ============================================================

import { Module } from '@nestjs/common';
import { SubMerchantsController } from './sub-merchants.controller';
import { SubMerchantsService } from './sub-merchants.service';
import { SubMerchantInvitesService } from './sub-merchant-invites.service';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AuditModule, NotificationsModule],
  controllers: [SubMerchantsController],
  providers: [SubMerchantsService, SubMerchantInvitesService],
  exports: [SubMerchantsService, SubMerchantInvitesService],
})
export class SubMerchantsModule {}
