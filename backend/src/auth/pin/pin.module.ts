// ============================================================
// Yene Verify — PIN Module
// ============================================================

import { Module } from '@nestjs/common';
import { PinService } from './pin.service';
import { PinRepository } from './pin.repository';
import { OtpModule } from '../otp/otp.module';

@Module({
  imports: [OtpModule],
  providers: [PinService, PinRepository],
  exports: [PinService, PinRepository],
})
export class PinModule {}
