// ============================================================
// Yene Verify â€” Google Auth Module
// ============================================================

import { Module } from '@nestjs/common';
import { GoogleAuthController } from './google-auth.controller';
import { GoogleAuthService } from './google-auth.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AppConfigModule } from '../config/config.module';
import { RedisModule } from '../redis/redis.module';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, AppConfigModule, RedisModule, AuthModule, AuditModule],
  providers: [GoogleAuthService],
  controllers: [GoogleAuthController],
})
export class GoogleAuthModule {}
