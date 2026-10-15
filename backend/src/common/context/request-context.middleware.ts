// ============================================================
// Yene Verify — Request Context Middleware
// Wraps each request in a Prisma transaction with RLS session
// variables set, using AsyncLocalStorage for context propagation.
// ============================================================

import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { requestContext, createRequestContext } from './request-context';

/**
 * Request-scoped context middleware.
 *
 * Flow:
 * 1. Create a RequestContext with the request ID.
 * 2. Open a Prisma interactive transaction.
 * 3. Run the rest of the pipeline inside the transaction via
 *    AsyncLocalStorage.run().
 * 4. The transaction commits after the handler returns.
 *
 * For @Public() routes (OTP, health, docs), we skip the transaction
 * to avoid holding connections unnecessarily.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const requestId = (req.headers['x-request-id'] as string | undefined) ?? 'unknown';

    // Check if this is a public route (skip transaction for public routes)
    // We can't easily check @Public() here, so we'll use a heuristic:
    // skip for known public paths
    const isPublicPath = this.isPublicPath(req.path);

    const runInTransaction = async () => {
      return this.prisma.$transaction(async (tx) => {
        // Store the transaction client so services can use it
        // We don't store it in context; instead services use PrismaService
        // which will use the transaction if we're inside one.
        // But we need to set the RLS session variables.

        // Set placeholder values — real values set by guards
        await this.setRlsSessionVars(tx, {
          userId: '',
          role: 'ANON',
          merchantId: '',
        });

        // Run the rest of the middleware chain
        return new Promise<void>((resolve, reject) => {
          const onFinish = () => {
            res.off('finish', onFinish);
            res.off('close', onClose);
            resolve();
          };
          const onClose = () => {
            res.off('finish', onFinish);
            res.off('close', onClose);
            reject(new Error('Client closed connection'));
          };
          res.on('finish', onFinish);
          res.on('close', onClose);
          next();
        });
      });
    };

    if (isPublicPath) {
      // For public routes, just set the context without a transaction
      void requestContext.run({ ...createRequestContext(requestId), isSystem: false }, async () => {
        next();
      });
    } else {
      void requestContext.run({ ...createRequestContext(requestId), isSystem: false }, async () => {
        try {
          await runInTransaction();
        } catch (e) {
          // If transaction fails, we still call next to let error handlers run
          next(e as Error);
        }
      });
    }
  }

  /**
   * Heuristic to detect public routes.
   * In production, you'd use a route registry; for now we hardcode known paths.
   */
  private isPublicPath(path: string): boolean {
    const publicPaths = [
      '/health',
      '/health/ready',
      '/api/v1/auth/request-otp',
      '/api/v1/auth/verify-otp',
      '/api/v1/auth/refresh',
      '/docs',
      '/docs/',
      '/docs-json',
    ];
    return publicPaths.some((p) => path.startsWith(p));
  }

  /**
   * Set RLS session variables on a transaction client.
   * Uses SET LOCAL so they're scoped to this transaction.
   */
  private async setRlsSessionVars(
    tx: any,
    ctx: { userId: string; role: string; merchantId: string },
  ): Promise<void> {
    await tx.$executeRawUnsafe(
      `SELECT set_config('app.current_user_id', $1, true),
              set_config('app.current_role', $2, true),
              set_config('app.current_merchant_id', $3, true)`,
      ctx.userId,
      ctx.role,
      ctx.merchantId,
    );
  }
}
