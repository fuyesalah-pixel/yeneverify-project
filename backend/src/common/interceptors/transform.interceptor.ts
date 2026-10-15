import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { successResponse } from '../types/api-response.type';

/** Paths excluded from the response envelope */
const SKIP_PATHS = ['/health', '/health/ready', '/docs', '/version', '/metrics', '/'];

/**
 * Wraps every successful response in the standard envelope:
 *   { success: true, data: ..., meta: { requestId } }
 *
 * Registered globally. Order: Logging → Timeout → Transform.
 */
@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = ctx.switchToHttp().getRequest<Request & { id?: string }>();
    const path = request.path ?? '';

    if (SKIP_PATHS.some((p) => path.startsWith(p))) {
      return next.handle();
    }

    const requestId = request.id ?? 'unknown';

    return next.handle().pipe(map((data) => successResponse(data, { requestId })));
  }
}
