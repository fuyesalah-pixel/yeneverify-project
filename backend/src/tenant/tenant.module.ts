// ============================================================
// Yene Verify — Tenant Module
// Wires tenant resolution, caching, and guards.
// ============================================================

import { CacheModule } from '@nestjs/cache-manager';
import { Global, Module } from '@nestjs/common';
import { createKeyv } from '@keyv/redis';
import { TenantResolverService } from './tenant.resolver.service';
import { TenantService } from './tenant.service';
import { AppConfigService } from '../config/config.service';

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => {
        const redisUrl = config.redis.url;
        return {
          store: createKeyv(redisUrl),
          ttl: 60 * 1000, // default 60s, tenant resolver uses 60s explicitly
        };
      },
    }),
  ],
  providers: [TenantResolverService, TenantService],
  exports: [TenantResolverService, TenantService],
})
export class TenantModule {}
