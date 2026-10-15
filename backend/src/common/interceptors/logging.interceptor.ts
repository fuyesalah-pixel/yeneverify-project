import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Logs request start and end with duration.
 * Never logs request/response bodies.
 * Order: Logging (outermost) → Timeout → Transform.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = ctx.switchToHttp().getRequest<Request & { id?: string }>();
    const { method, path } = request;
    const requestId = request.id ?? 'unknown';
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - start;
          const res = ctx.switchToHttp().getResponse<{ statusCode: number }>();
          this.logger.log(`${method} ${path} ${res.statusCode} +${ms}ms [${requestId}]`);
        },
        error: (err: Error) => {
          const ms = Date.now() - start;
          this.logger.error(`${method} ${path} ERROR +${ms}ms [${requestId}] ${err.message}`);
        },
      }),
    );
  }
}
