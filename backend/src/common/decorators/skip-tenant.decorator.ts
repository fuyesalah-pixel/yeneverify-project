// ============================================================
// Yene Verify — SkipTenant Decorator
// Marks a route as not requiring tenant resolution.
// Used by routes that must run BEFORE a merchant/sub-merchant
// scope exists — e.g. onboarding itself.
// ============================================================

import { SetMetadata } from '@nestjs/common';

export const SKIP_TENANT_KEY = 'skipTenant';

export const SkipTenant = () => SetMetadata(SKIP_TENANT_KEY, true);
