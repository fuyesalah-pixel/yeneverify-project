import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { APP_GUARD } from '@nestjs/core';

import { AppConfigModule } from './config/config.module';
import { AppConfigService } from './config/config.service';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { QueueModule } from './queue/queue.module';
import { StorageModule } from './storage/storage.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { TenantModule } from './tenant/tenant.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { TenantGuard } from './common/guards/tenant.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { TenantRequiredGuard } from './common/guards/tenant-required.guard';
import { AdminOnlyGuard } from './common/guards/admin-only.guard';

import { OnboardedGuard } from './common/guards/onboarded.guard';
import { OnboardingModule } from './onboarding/onboarding.module';
import { SubMerchantsModule } from './sub-merchants/sub-merchants.module';
import { MerchantsModule } from './merchants/merchants.module';

import { RootController } from './root/root.controller';
import { VersionController } from './version/version.controller';

import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { RequestContextMiddleware } from './common/context/request-context.middleware';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { buildLoggerOptions } from './common/logger/logger.config';

// ============================================================
// Yene Verify — AppModule
//
// Root module. Wires all cross-cutting concerns globally.
// Feature modules (AuthModule, VerificationModule, etc.) are
// added in later steps without modifying this file's structure.
//
// Interceptor order (outermost first):
//   LoggingInterceptor → TimeoutInterceptor → TransformInterceptor
// ============================================================

@Module({
  imports: [
    // ── Config (global) ───────────────────────────────────────────────
    AppConfigModule,

    // ── Logging (nestjs-pino) ─────────────────────────────────────────
    LoggerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (cfg: AppConfigService) =>
        buildLoggerOptions(cfg.runtime.isDev, cfg.runtime.logLevel),
    }),

    // ── Rate limiting ─────────────────────────────────────────────────
    ThrottlerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (cfg: AppConfigService) => ({
        throttlers: [{ ttl: cfg.throttle.ttl * 1000, limit: cfg.throttle.limit }],
      }),
    }),

    // ── Infrastructure (all global) ───────────────────────────────────
    PrismaModule,
    RedisModule,
    QueueModule,
    StorageModule,

    // ── Feature ───────────────────────────────────────────────────────
    HealthModule,
    AuthModule,
    AuditModule,
    TenantModule,
    OnboardingModule,
    SubMerchantsModule,
    MerchantsModule,

    // Feature modules added here in Steps 13+:
    // VerificationModule,
    // TransactionsModule,
    // CreditsModule,
    // BillingModule,
    // AnalyticsModule,
    // NotificationsModule,
    // ExportsModule,
  ],

  controllers: [RootController, VersionController],

  providers: [
    // ── Rate limiting guard (global) ──────────────────────────────────
    { provide: APP_GUARD, useClass: ThrottlerGuard },

    // ── Auth guard (global) ───────────────────────────────────────────
    // Step 9: JwtAuthGuard with @Public() opt-out
    { provide: APP_GUARD, useClass: JwtAuthGuard },

    // ── Tenant guard (global) ─────────────────────────────────────────
    // Step 10: Resolves tenant scope, sets RLS context
    { provide: APP_GUARD, useClass: TenantGuard },

    // ── RBAC guard (global) ───────────────────────────────────────────
    // Step 10: Enforces @Roles() and @AdminOnly()
    { provide: APP_GUARD, useClass: RolesGuard },

    // ── Onboarded guard (global) ────────────────────────────────────────
    // Step 12: Enforces @SkipOnboarding() and checks onboarding status
    { provide: APP_GUARD, useClass: OnboardedGuard },

    // ── Tenant required guard (global) ────────────────────────────────
    // Step 10: Enforces @TenantRequired()
    { provide: APP_GUARD, useClass: TenantRequiredGuard },

    // ── Admin only guard (global) ─────────────────────────────────────
    // Step 10: Enforces @AdminOnly()
    { provide: APP_GUARD, useClass: AdminOnlyGuard },

    // ── Interceptors — order matters: Logging → Timeout → Transform ───
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TimeoutInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },

    // ── Global exception filter ───────────────────────────────────────
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
