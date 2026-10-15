// ============================================================
// Yene Verify — Step-Up Module
// ============================================================

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { StepUpService } from './step-up.service';
import { StepUpGuard } from './step-up.guard';
import { AppConfigService } from '../../config/config.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        secret: config.jwt.accessSecret,
        signOptions: {
          issuer: config.jwt.issuer,
          audience: config.jwt.audience,
        },
      }),
    }),
  ],
  providers: [StepUpService, StepUpGuard],
  exports: [StepUpService, StepUpGuard],
})
export class StepUpModule {}
