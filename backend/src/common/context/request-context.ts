// ============================================================
// Yene Verify — Request Context (AsyncLocalStorage)
// Per-request storage for AuthUser + tenant + system flags.
// ============================================================

import { AsyncLocalStorage } from 'node:async_hooks';
import type { AuthUser } from '../types/auth-user.type';

/**
 * The request-scoped context carried through the entire request lifecycle.
 * Populated by JwtAuthGuard → TenantGuard → middleware.
 */
export interface RequestContext {
  /** Authenticated user (set by JwtAuthGuard) */
  user?: AuthUser;
  /** Tenant scope: merchantId + optional subMerchantId (set by TenantGuard) */
  tenant?: {
    merchantId: string;
    subMerchantId?: string;
  };
  /** True for background jobs / admin bypass (runAsSystem) */
  isSystem: boolean;
  /** Request ID from middleware */
  requestId?: string;
}

/** AsyncLocalStorage instance — one store per request. */
const storage = new AsyncLocalStorage<RequestContext>();

/**
 * Request context API.
 * All access goes through this object; never read storage directly.
 */
export const requestContext = {
  /**
   * Run a callback with a specific context.
   * Used by middleware to seed the context, and by background jobs
   * (runAsSystem / runAsMerchant) to create their own scope.
   */
  run<T>(ctx: RequestContext, fn: () => Promise<T>): Promise<T> {
    return storage.run(ctx, fn);
  },

  /**
   * Get the current context (may be undefined outside a request).
   */
  get(): RequestContext | undefined {
    return storage.getStore();
  },

  /**
   * Get the current context or throw if missing.
   * Use in services that require a tenant context.
   */
  mustGet(): RequestContext {
    const ctx = storage.getStore();
    if (!ctx) {
      throw new Error(
        'No request context available — are you running inside a request or a job with a context?',
      );
    }
    return ctx;
  },

  /** Convenience getters */
  get user(): AuthUser | undefined {
    return storage.getStore()?.user;
  },

  get tenant(): { merchantId: string; subMerchantId?: string } | undefined {
    return storage.getStore()?.tenant;
  },

  get isSystem(): boolean {
    return storage.getStore()?.isSystem ?? false;
  },

  get requestId(): string | undefined {
    return storage.getStore()?.requestId;
  },

  /** Check if we're inside a merchant-scoped request (not system, has tenant) */
  get isMerchantScoped(): boolean {
    const ctx = storage.getStore();
    return !!ctx && !ctx.isSystem && !!ctx.tenant;
  },
};

/**
 * Create a base context for a request.
 * Called by the middleware to seed the store before guards run.
 */
export function createRequestContext(requestId: string): RequestContext {
  return {
    isSystem: false,
    requestId,
  };
}

/**
 * Attach the authenticated user to the current context.
 * Called by JwtAuthGuard after token validation.
 */
export function setUserContext(user: AuthUser): void {
  const ctx = storage.getStore();
  if (ctx) ctx.user = user;
}

/**
 * Attach the tenant scope to the current context.
 * Called by TenantGuard after resolving merchant/sub-merchant.
 */
export function setTenantContext(merchantId: string, subMerchantId?: string): void {
  const ctx = storage.getStore();
  if (ctx) {
    ctx.tenant = { merchantId, subMerchantId };
  }
}

/**
 * Mark the current context as a system context (bypasses RLS).
 * Called by runAsSystem.
 */
export function setSystemContext(): void {
  const ctx = storage.getStore();
  if (ctx) ctx.isSystem = true;
}

/**
 * Clear tenant/user context — used when leaving a scope.
 */
export function clearContext(): void {
  const ctx = storage.getStore();
  if (ctx) {
    ctx.user = undefined;
    ctx.tenant = undefined;
    ctx.isSystem = false;
  }
}
