// ============================================================
// Yene Verify — Merchants Module
// ============================================================

import { Module } from '@nestjs/common';
import { MerchantsController } from './merchants.controller';
import { MerchantsService } from './merchants.service';
import { PrismaModule } from '../prisma/prisma.module';
import { StepUpModule } from '../auth/step-up/step-up.module';

@Module({
  imports: [PrismaModule, StepUpModule],
  controllers: [MerchantsController],
  providers: [MerchantsService],
  exports: [MerchantsService],
})
export class MerchantsModule {}
