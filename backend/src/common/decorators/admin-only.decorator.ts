// ============================================================
// Yene Verify — @AdminOnly() Decorator
// Restricts a route to ADMIN role only.
// ============================================================

import { SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const ADMIN_ONLY_KEY = 'adminOnly';

/** Marks a route as admin-only. Requires ADMIN role. */
export const AdminOnly = () => {
  return SetMetadata(ADMIN_ONLY_KEY, true);
};

/** Checks if a route is marked as admin-only. */
export function isAdminOnlyRoute(reflector: Reflector, ctx: any): boolean {
  return (
    reflector.getAllAndOverride<boolean>(ADMIN_ONLY_KEY, [ctx.getHandler(), ctx.getClass()]) ??
    false
  );
}
