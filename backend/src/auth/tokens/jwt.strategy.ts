// ============================================================
// Yene Verify — JWT Passport Strategy
// Validates access tokens and attaches AuthUser to request.
// ============================================================

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppConfigService } from '../../config/config.service';
import { TokenService } from './token.service';
import { AuthUser } from '../guards/jwt-auth.guard';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: AppConfigService,
    private readonly tokenService: TokenService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.jwt.accessSecret,
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
      passReqToCallback: true,
    });
  }

  /**
   * Validate the JWT payload and load session/device from DB.
   * Called by Passport after token signature/claims are verified.
   */
  async validate(
    _req: Request,
    payload: {
      sub: string;
      role: string;
      merchantId?: string;
      sid: string;
      did: string;
    },
  ): Promise<AuthUser> {
    // Note: We don't actually validate the refresh token here.
    // The access token itself is validated by Passport.
    // We just need to check if the session/device are still valid.

    const sessionRecord = await this.tokenService['prisma'].session.findUnique({
      where: { id: payload.sid },
      include: {
        user: {
          select: { id: true, role: true, status: true, ownedMerchant: { select: { id: true } } },
        },
        device: {
          select: { id: true, revokedAt: true },
        },
      },
    });

    if (!sessionRecord) {
      throw new UnauthorizedException('Session not found');
    }

    if (sessionRecord.revokedAt) {
      throw new UnauthorizedException('Session revoked');
    }

    if (sessionRecord.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expired');
    }

    if (sessionRecord.device.revokedAt) {
      throw new UnauthorizedException('Device revoked');
    }

    if (sessionRecord.user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account inactive');
    }

    // Update last used
    await this.tokenService['prisma'].session.update({
      where: { id: payload.sid },
      data: { lastUsedAt: new Date() },
    });

    return {
      id: payload.sub,
      role: payload.role as AuthUser['role'],
      merchantId: payload.merchantId,
      sessionId: payload.sid,
      deviceId: payload.did,
    };
  }
}
