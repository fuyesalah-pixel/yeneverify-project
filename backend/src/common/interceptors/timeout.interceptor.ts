import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { ServiceUnavailableError } from '../errors/domain-errors';

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Fails requests that take longer than DEFAULT_TIMEOUT_MS (30s).
 * Order: Logging → Timeout → Transform.
 */
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      timeout(DEFAULT_TIMEOUT_MS),
      catchError((err: unknown) => {
        if (err instanceof TimeoutError) {
          return throwError(() => new ServiceUnavailableError('Request timed out.'));
        }
        return throwError(() => err);
      }),
    );
  }
}
