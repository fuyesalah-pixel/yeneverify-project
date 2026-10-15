// ============================================================
// Yene Verify — Onboarded Guard
// Ensures the user has completed onboarding before accessing
// protected routes. Skips for routes marked with @SkipOnboarding().
// ============================================================

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthUser } from '../types/auth-user.type';
import { OnboardingStatusService } from '../../onboarding/onboarding-status.service';
import { OnboardingRequiredError } from '../errors/domain-errors';
import { SKIP_ONBOARDING_KEY } from '../decorators/skip-onboarding.decorator';

@Injectable()
export class OnboardedGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly statusService: OnboardingStatusService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_ONBOARDING_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    if (skip) return true;

    const req = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = req.user;

    if (!user) return true; // public route or unauthenticated

    if (user.role === 'ADMIN') return true;

    const status = await this.statusService.getStatus(user);

    if (status.needsOnboarding) {
      throw new OnboardingRequiredError(status.step, status.pendingInvite);
    }

    return true;
  }
}
