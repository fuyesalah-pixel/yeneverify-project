// Mirror of shared/contracts/roles.json — keep in sync.
export const ROLES = {
  ADMIN: 'ADMIN',
  MERCHANT: 'MERCHANT',
  SUB_MERCHANT: 'SUB_MERCHANT',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

/** Numeric level — higher = more privileged. */
export const ROLE_LEVELS: Record<Role, number> = {
  ADMIN: 100,
  MERCHANT: 50,
  SUB_MERCHANT: 10,
};
