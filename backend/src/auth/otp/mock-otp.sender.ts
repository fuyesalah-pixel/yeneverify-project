// ============================================================
// Yene Verify — Mock OTP Sender (Development)
// ============================================================

import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../../config/config.service';
import { OtpSender } from './otp.sender';
import { OtpPurpose } from '../constants';

@Injectable()
export class MockOtpSender implements OtpSender {
  private readonly logger = new Logger(MockOtpSender.name);

  constructor(_config: AppConfigService) {}

  async send(phone: string, code: string, purpose: OtpPurpose): Promise<void> {
    const maskedPhone = this.maskPhone(phone);

    // In development, log the OTP to console for easy testing
    this.logger.log({
      event: 'otp.send.mock',
      provider: 'mock',
      phone: maskedPhone,
      purpose,
      code, // Only in development!
    });

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  private maskPhone(phone: string): string {
    if (phone.startsWith('+251') && phone.length === 13) {
      return `+2519*****${phone.slice(-2)}`;
    }
    return phone;
  }
}
