// ============================================================
// Yene Verify — SkipOnboarding Decorator
// Marks a route as exempt from the OnboardedGuard.
// ============================================================

import { SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const SKIP_ONBOARDING_KEY = 'skipOnboarding';

/** Marks a route as not requiring onboarding completion. */
export const SkipOnboarding = () => SetMetadata(SKIP_ONBOARDING_KEY, true);

/** Checks if a route is marked as skip onboarding. */
export function isSkipOnboardingRoute(reflector: Reflector, ctx: any): boolean {
  return (
    reflector.getAllAndOverride<boolean>(SKIP_ONBOARDING_KEY, [ctx.getHandler(), ctx.getClass()]) ??
    false
  );
}
