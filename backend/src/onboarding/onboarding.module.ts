// ============================================================
// Yene Verify — Onboarding Module
// ============================================================

import { Module } from '@nestjs/common';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { OnboardingStatusService } from './onboarding-status.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [OnboardingController],
  providers: [OnboardingService, OnboardingStatusService],
  exports: [OnboardingService, OnboardingStatusService],
})
export class OnboardingModule {}
