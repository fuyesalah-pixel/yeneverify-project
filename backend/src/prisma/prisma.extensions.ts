// ============================================================
// Yene Verify — Prisma Extensions for RLS
// Extensions that enforce request/job context on every query.
// The actual RLS session variables are set transactionally by
// PrismaService.withTenant / setTenantContext.
// ============================================================

import { Prisma } from '@prisma/client';
import { requestContext } from '../common/context/request-context';

/**
 * Extension that guards every query behind a request context.
 *
 * - No context at all        → reject (prevents unscoped queries)
 * - System context (jobs)    → allow
 * - Merchant-scoped request  → allow (RLS vars are set transactionally)
 */
export const tenantExtension = Prisma.defineExtension((client) => {
  return client.$extends({
    name: 'rls-tenant',
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const ctx = requestContext.get();

          if (!ctx) {
            throw new Error(
              'No request context available. ' +
                'Queries must run inside a request context or a job context. ' +
                'Use runAsSystem, runAsMerchant, or ensure middleware is configured.',
            );
          }

          if (!ctx.isSystem && !ctx.tenant) {
            throw new Error(
              'No tenant context available. ' +
                'Authenticated routes must have a tenant scope. ' +
                'Ensure TenantGuard runs and sets the tenant.',
            );
          }

          return query(args);
        },
      },
    },
  });
});

/**
 * Extension for background jobs: requires *some* context (set by
 * runAsSystem / runAsMerchant / runAsAdmin) but allows system scope.
 */
export const jobContextExtension = Prisma.defineExtension((client) => {
  return client.$extends({
    name: 'job-context',
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const ctx = requestContext.get();

          if (!ctx) {
            throw new Error(
              'No job context available. Use runAsSystem, runAsMerchant, or runAsAdmin.',
            );
          }

          return query(args);
        },
      },
    },
  });
});
