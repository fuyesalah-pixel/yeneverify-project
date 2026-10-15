// ============================================================
// Yene Verify — Optional Auth Guard
// Parses JWT if present but doesn't require it.
// Useful for endpoints that behave differently for authenticated users.
// ============================================================

import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalAuthGuard extends AuthGuard('jwt') {
  canActivate(_context: ExecutionContext): boolean | Promise<boolean> {
    // Always allow - we just want to parse the token if present
    return true;
  }

  handleRequest(err: Error | null, user: any): any {
    // If there's an error or no user, just return null (not an error)
    if (err || !user) {
      return null;
    }
    return user;
  }
}
