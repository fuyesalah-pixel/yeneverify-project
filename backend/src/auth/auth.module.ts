// ============================================================
// Yene Verify — Auth Module
// Wires all auth components together.
// ============================================================

import { Module, OnModuleInit } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { BullModule } from '@nestjs/bullmq';
import { HttpModule } from '@nestjs/axios';
import { QueueModule } from '../queue/queue.module';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

import { OtpModule } from './otp/otp.module';

import { TokenService } from './tokens/token.service';
import { TokenRepository } from './tokens/token.repository';
import { JwtStrategy } from './tokens/jwt.strategy';

import { SessionService } from './session/session.service';
import { SessionRepository } from './session/session.repository';

import { DeviceService } from './device/device.service';
import { DeviceRepository } from './device/device.repository';

import { PinModule } from './pin/pin.module';
import { BiometricModule } from './biometric/biometric.module';
import { StepUpModule } from './step-up/step-up.module';

import { AuditModule } from '../audit/audit.module';
import { AppConfigService } from '../config/config.service';

@Module({
  imports: [
    HttpModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        secret: config.jwt.accessSecret,
        signOptions: {
          expiresIn: config.jwt.accessTtl,
          issuer: config.jwt.issuer,
          audience: config.jwt.audience,
        },
      }),
    }),
    BullModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        connection: {
          host: new URL(config.redis.url).hostname,
          port: parseInt(new URL(config.redis.url).port || '6379', 10),
          password: new URL(config.redis.url).password || undefined,
        },
      }),
    }),
    QueueModule,
    AuditModule,
    OtpModule,
    PinModule,
    BiometricModule,
    StepUpModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,

    // Tokens
    TokenService,
    TokenRepository,
    JwtStrategy,

    // Session
    SessionService,
    SessionRepository,

    // Device
    DeviceService,
    DeviceRepository,
  ],
  exports: [AuthService, TokenService, SessionService, DeviceService, OtpModule],
})
export class AuthModule implements OnModuleInit {
  // Maintenance jobs registered via QueueModule
  async onModuleInit(): Promise<void> {
    // Workers are registered in QueueModule
  }
}
