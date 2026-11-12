// ============================================================
// Yene Verify — Admin Module
// ============================================================

import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AppConfigModule } from '../config/config.module';
import { RedisModule } from '../redis/redis.module';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { CreditsModule } from '../credits/credits.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PlatformConfigModule } from '../platform-config/platform-config.module';
import { firebaseAdminProvider } from '../common/firebase/firebase-admin.provider';

@Module({
  imports: [
    PrismaModule,
    AppConfigModule,
    RedisModule,
    AuthModule,
    AuditModule,
    CreditsModule,
    NotificationsModule,
    PlatformConfigModule,
  ],
  providers: [firebaseAdminProvider, AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
