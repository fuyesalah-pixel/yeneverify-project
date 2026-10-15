import type { Role } from '../constants/roles';

/**
 * The authenticated user payload attached to every request by JwtAuthGuard.
 * Accessed via @CurrentUser() decorator.
 */
export interface AuthUser {
  /** User UUID */
  id: string;
  /** User role */
  role: Role;
  /** Merchant UUID — set for MERCHANT and SUB_MERCHANT roles */
  merchantId?: string;
  /** SubMerchant UUID — set only for SUB_MERCHANT role */
  subMerchantId?: string;
  /** Bound device UUID */
  deviceId?: string;
  /** Active session UUID */
  sessionId?: string;
}
