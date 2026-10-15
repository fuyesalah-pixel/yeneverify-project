// ============================================================
// Yene Verify — Step-Up Service
// Issues and validates step-up tokens for sensitive operations.
// ============================================================

import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppConfigService } from '../../config/config.service';
import { AuditService } from '../../audit/audit.service';

export interface StepUpTokenClaims {
  sub: string;
  sid: string;
  did: string;
  scope: 'step-up';
  iat: number;
  exp: number;
}

@Injectable()
export class StepUpService {
  private readonly logger = new Logger(StepUpService.name);
  private readonly jwt: JwtService;

  constructor(
    private readonly config: AppConfigService,
    private readonly audit: AuditService,
  ) {
    this.jwt = new JwtService({
      secret: config.jwt.accessSecret,
      signOptions: {
        issuer: config.jwt.issuer,
        audience: config.jwt.audience,
      },
    });
  }

  async issueStepUpTokenPin(
    userId: string,
    sessionId: string,
    deviceId: string,
    ip: string,
  ): Promise<{ stepUpToken: string; expiresIn: number }> {
    const ttl = this.config.stepUp.tokenTtlSeconds;

    const stepUpToken = this.jwt.sign(
      {
        sub: userId,
        sid: sessionId,
        did: deviceId,
        scope: 'step-up',
      },
      { expiresIn: ttl },
    );

    this.audit.log({
      actorType: 'USER',
      actorUserId: userId,
      action: 'auth.step_up.pin',
      ip,
      metadata: { sessionId, deviceId },
    });

    this.logger.log({ event: 'auth.step_up.pin', userId, sessionId });
    return { stepUpToken, expiresIn: ttl };
  }

  async issueStepUpTokenBiometric(
    userId: string,
    sessionId: string,
    deviceId: string,
    ip: string,
  ): Promise<{ stepUpToken: string; expiresIn: number }> {
    const ttl = this.config.stepUp.tokenTtlSeconds;

    const stepUpToken = this.jwt.sign(
      {
        sub: userId,
        sid: sessionId,
        did: deviceId,
        scope: 'step-up',
      },
      { expiresIn: ttl },
    );

    this.audit.log({
      actorType: 'USER',
      actorUserId: userId,
      action: 'auth.step_up.biometric',
      ip,
      metadata: { sessionId, deviceId },
    });

    this.logger.log({ event: 'auth.step_up.biometric', userId, sessionId });
    return { stepUpToken, expiresIn: ttl };
  }

  async validateStepUpToken(stepUpToken: string): Promise<StepUpTokenClaims> {
    try {
      const decoded = await this.jwt.verifyAsync<StepUpTokenClaims>(stepUpToken, {
        secret: this.config.jwt.accessSecret,
        issuer: this.config.jwt.issuer,
        audience: this.config.jwt.audience,
      });

      if (decoded.scope !== 'step-up') {
        throw new Error('Invalid token scope');
      }

      return decoded;
    } catch (error) {
      const err = error as Error & { name?: string };
      if (err.name === 'TokenExpiredError') {
        throw new Error('Step-up token expired');
      }
      throw new Error('Invalid step-up token');
    }
  }
}
