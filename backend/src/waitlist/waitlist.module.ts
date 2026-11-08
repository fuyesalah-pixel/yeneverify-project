// ============================================================
// Yene Verify â€” Waitlist Module
// ============================================================

import { Module } from '@nestjs/common';
import { WaitlistController } from './waitlist.controller';
import { WaitlistService } from './waitlist.service';
import { WaitlistRepository } from './waitlist.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [PrismaModule, RedisModule],
  providers: [WaitlistRepository, WaitlistService],
  controllers: [WaitlistController],
})
export class WaitlistModule {}
