import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient, UserRole } from '@prisma/client';
import { AppConfigService } from '../config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(private readonly config: AppConfigService) {
    super({
      datasources: { db: { url: config.database.url } },
      log: config.runtime.isDev
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'event', level: 'warn' },
            { emit: 'event', level: 'error' },
          ]
        : [
            { emit: 'event', level: 'warn' },
            { emit: 'event', level: 'error' },
          ],
    });
    this.registerEventListeners();
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('Connecting to PostgreSQL…');
    await this.$connect();
    this.logger.log('PostgreSQL connected.');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Runs fn inside a transaction with RLS session variables set.
   * This is the ONLY correct way to run tenant-scoped queries.
   */
  async withTenant<T>(
    ctx: { userId: string; role: UserRole; merchantId?: string },
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.current_user_id', $1, true),
                set_config('app.current_role', $2, true),
                set_config('app.current_merchant_id', $3, true)`,
        ctx.userId,
        ctx.role as string,
        ctx.merchantId ?? '',
      );
      return fn(tx);
    });
  }

  /**
   * Runs fn inside a transaction with admin RLS session variables set
   * (bypasses row-level security). For background jobs and system
   * maintenance only.
   */
  async runAsAdmin<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.current_user_id', $1, true),
                set_config('app.current_role', $2, true),
                set_config('app.current_merchant_id', $3, true)`,
        '',
        'ADMIN',
        '',
      );
      return fn(tx);
    });
  }

  /** Set tenant context on the current connection (non-transactional). */
  async setTenantContext(userId: string, role: UserRole, merchantId?: string): Promise<void> {
    await this.$executeRawUnsafe(
      `SELECT set_config('app.current_user_id', $1, true),
              set_config('app.current_role', $2, true),
              set_config('app.current_merchant_id', $3, true)`,
      userId,
      role as string,
      merchantId ?? '',
    );
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  private registerEventListeners(): void {
    (this as unknown as { $on: (event: string, cb: (e: { message: string }) => void) => void }).$on(
      'warn',
      (e) => this.logger.warn(e.message),
    );
    (this as unknown as { $on: (event: string, cb: (e: { message: string }) => void) => void }).$on(
      'error',
      (e) => this.logger.error(e.message),
    );
    if (this.config.runtime.isDev) {
      (
        this as unknown as {
          $on: (event: string, cb: (e: { query: string; duration: number }) => void) => void;
        }
      ).$on('query', (e) => this.logger.debug(`[${e.duration}ms] ${e.query}`));
    }
  }
}
