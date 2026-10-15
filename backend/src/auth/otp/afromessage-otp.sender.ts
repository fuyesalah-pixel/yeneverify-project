// ============================================================
// Yene Verify — AfroMessage OTP Sender (Production)
// ============================================================

import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, timeout } from 'rxjs';
import { AppConfigService } from '../../config/config.service';
import { OtpSender } from './otp.sender';
import { OtpPurpose } from '../constants';

interface AfroMessageResponse {
  success: boolean;
  message?: string;
  data?: unknown;
}

@Injectable()
export class AfroMessageOtpSender implements OtpSender {
  private readonly logger = new Logger(AfroMessageOtpSender.name);
  private readonly http: HttpService;

  constructor(
    private readonly config: AppConfigService,
    httpService: HttpService,
  ) {
    this.http = httpService;
  }

  async send(phone: string, code: string, purpose: OtpPurpose): Promise<void> {
    const maskedPhone = this.maskPhone(phone);
    const senderId = this.config.afroMessage.senderId;
    const apiKey = this.config.afroMessage.apiKey;
    const baseUrl = this.config.afroMessage.baseUrl;
    const timeoutMs = this.config.afroMessage.timeoutMs;

    const message = `Your Yene Verify code is ${code}. Valid for 5 minutes.`;

    const payload = {
      to: phone,
      message,
      sender: senderId,
    };

    this.logger.log({
      event: 'otp.send',
      provider: 'afromessage',
      phone: maskedPhone,
      purpose,
    });

    try {
      const response = await firstValueFrom(
        this.http
          .post<AfroMessageResponse>(`${baseUrl}/send`, payload, {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            timeout: timeoutMs,
          })
          .pipe(timeout(timeoutMs)),
      );

      if (!response.data.success) {
        this.logger.error({
          event: 'otp.send.failed',
          provider: 'afromessage',
          phone: maskedPhone,
          purpose,
          response: response.data,
        });
        throw new Error(response.data.message || 'AfroMessage returned an error');
      }

      this.logger.log({
        event: 'otp.send.success',
        provider: 'afromessage',
        phone: maskedPhone,
        purpose,
      });
    } catch (error) {
      const err = error as Error & { response?: { status?: number } };

      // Map specific HTTP statuses to meaningful errors
      const status = err.response?.status;
      if (status === 401) {
        this.logger.error({
          event: 'otp.send.unauthorized',
          provider: 'afromessage',
          phone: maskedPhone,
        });
        throw new Error('AfroMessage authentication failed');
      }
      if (status === 429) {
        this.logger.warn({
          event: 'otp.send.rate_limited',
          provider: 'afromessage',
          phone: maskedPhone,
        });
        throw new Error('AfroMessage rate limit exceeded');
      }

      this.logger.error({
        event: 'otp.send.error',
        provider: 'afromessage',
        phone: maskedPhone,
        purpose,
        error: err.message,
      });
      throw new Error('SMS provider unavailable');
    }
  }

  private maskPhone(phone: string): string {
    // +2519xxxxxxxx -> +2519*****xx
    if (phone.startsWith('+251') && phone.length === 13) {
      return `+2519*****${phone.slice(-2)}`;
    }
    return phone;
  }
}
