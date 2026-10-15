// ============================================================
// Yene Verify — JWT Auth Guard
// Global guard that validates JWT access tokens.
// Respects @Public() decorator for opt-out.
// ============================================================

import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';

export interface AuthUser {
  id: string;
  role: 'ADMIN' | 'MERCHANT' | 'SUB_MERCHANT';
  merchantId?: string;
  sessionId: string;
  deviceId: string;
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest<TUser = AuthUser>(
    err: Error | null,
    user: AuthUser | false,
    _info: Error | null,
    _context?: ExecutionContext,
    _status?: number,
  ): TUser {
    if (err || !user) {
      throw err || new UnauthorizedException('Invalid or expired token');
    }
    return user as TUser;
  }
}
