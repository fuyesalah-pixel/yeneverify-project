// ============================================================
// Yene Verify — Roles Guard
// Enforces @Roles(...) metadata on routes.
// Runs after JwtAuthGuard (req.user is set).
// ============================================================

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { AuthUser } from '../types/auth-user.type';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { Role } from '../constants/roles';
import { ForbiddenError } from '../errors/domain-errors';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    // No @Roles() metadata → no restriction
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const user = req.user;

    if (!user) {
      // Should not happen — JwtAuthGuard runs first
      return false;
    }

    // ADMIN bypasses all role checks
    if (user.role === 'ADMIN') return true;

    if (!requiredRoles.includes(user.role as Role)) {
      throw new ForbiddenError(`Role ${user.role} is not permitted for this action.`);
    }

    return true;
  }
}
