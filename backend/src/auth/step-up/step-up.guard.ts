// ============================================================
// Yene Verify — Step-Up Guard
// Enforces @RequireStepUp() metadata on routes requiring
// step-up authentication.
// ============================================================

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { StepUpService } from './step-up.service';

export const REQUIRE_STEP_UP_KEY = 'requireStepUp';

/** Marks a route as requiring step-up authentication. */
export const RequireStepUp = () => {
  return (target: any, _propertyKey?: string, descriptor?: PropertyDescriptor) => {
    // This is a metadata-based approach - the guard checks for this metadata
    if (descriptor) {
      Reflect.defineMetadata(REQUIRE_STEP_UP_KEY, true, descriptor.value);
    } else {
      Reflect.defineMetadata(REQUIRE_STEP_UP_KEY, true, target);
    }
    return descriptor;
  };
};

/** Checks if a route requires step-up authentication. */
export function isStepUpRequired(reflector: Reflector, ctx: any): boolean {
  return (
    reflector.getAllAndOverride<boolean>(REQUIRE_STEP_UP_KEY, [ctx.getHandler(), ctx.getClass()]) ??
    false
  );
}

@Injectable()
export class StepUpGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly stepUpService: StepUpService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isRequired = this.reflector.getAllAndOverride<boolean>('requireStepUp', [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    if (!isRequired) return true;

    const req = ctx.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: any;
    }>();

    const user = req.user;
    if (!user) return false;

    // Get step-up token from header
    const stepUpToken = req.headers['x-step-up-token'];
    if (!stepUpToken) {
      throw new Error('AUTH_STEP_UP_REQUIRED');
    }

    try {
      const claims = await this.stepUpService.validateStepUpToken(stepUpToken);

      // Verify the step-up token matches the current user and session
      if (claims.sub !== user.id || claims.sid !== user.sessionId || claims.did !== user.deviceId) {
        throw new Error('Invalid step-up token');
      }

      // Attach step-up claims to request for downstream use
      (req as any).stepUpClaims = claims;
      return true;
    } catch (error) {
      const err = error as Error;
      if (err.message === 'Step-up token expired') {
        throw new Error('AUTH_STEP_UP_EXPIRED');
      }
      throw new Error('AUTH_STEP_UP_REQUIRED');
    }
  }
}
