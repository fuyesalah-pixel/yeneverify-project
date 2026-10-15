import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { UnauthorizedError } from '../errors/domain-errors';

/**
 * Global JWT authentication guard.
 * - Skips auth for routes decorated with @Public().
 * - Validates the Bearer token via the 'jwt' Passport strategy.
 * - The strategy is registered in AuthModule (Step 9).
 *
 * PLACEHOLDER: strategy registration is incomplete until Step 9.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(ctx: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(ctx);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handleRequest<T>(err: Error | null, user: T): T {
    if (err || !user) {
      throw err ?? new UnauthorizedError('Invalid or missing access token.');
    }
    return user;
  }
}
