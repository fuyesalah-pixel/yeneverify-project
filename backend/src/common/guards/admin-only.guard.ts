// ============================================================
// Yene Verify — AdminOnly Guard
// Enforces @AdminOnly() metadata: route requires ADMIN role.
// ============================================================

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthUser } from '../types/auth-user.type';
import { ADMIN_ONLY_KEY } from '../decorators/admin-only.decorator';
import { ForbiddenError } from '../errors/domain-errors';

@Injectable()
export class AdminOnlyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const isAdminOnly = this.reflector.getAllAndOverride<boolean>(ADMIN_ONLY_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    if (!isAdminOnly) return true;

    const req = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = req.user;

    if (!user || user.role !== 'ADMIN') {
      throw new ForbiddenError('Admin access required.');
    }

    return true;
  }
}
