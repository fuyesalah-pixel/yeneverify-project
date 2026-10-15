// ============================================================
// Yene Verify — OTP Module
// Owns the OTP service, repository, rate limiter, and the
// swappable sender so AuthModule and PinModule can both
// inject OtpService without a circular module dependency.
// ============================================================

import { Module } from '@nestjs/common';
import { HttpModule, HttpService } from '@nestjs/axios';
import { AppConfigService } from '../../config/config.service';
import { OtpService } from './otp.service';
import { OtpRepository } from './otp.repository';
import { OtpRateLimiter } from './otp.rate-limiter';
import { AfroMessageOtpSender } from './afromessage-otp.sender';
import { MockOtpSender } from './mock-otp.sender';

@Module({
  imports: [HttpModule],
  providers: [
    OtpRepository,
    OtpRateLimiter,
    AfroMessageOtpSender,
    MockOtpSender,
    OtpService,
    {
      provide: 'OtpSender',
      useFactory: (config: AppConfigService, http: HttpService) =>
        config.afroMessage.mock
          ? new MockOtpSender(config)
          : new AfroMessageOtpSender(config, http),
      inject: [AppConfigService, HttpService],
    },
  ],
  exports: [OtpService, OtpRepository, OtpRateLimiter, 'OtpSender'],
})
export class OtpModule {}
