import { SetMetadata } from '@nestjs/common';
import type { Role } from '../constants/roles';
export const ROLES_KEY = 'roles';
/** Restrict a route to one or more roles. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
