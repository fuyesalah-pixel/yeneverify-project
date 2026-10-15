// ============================================================
// Yene Verify — Seed Profiles
//
// Controls what data is seeded via the SEED_PROFILE env var.
//
// Profiles:
//   minimal  → packages, feature flags, admin only (CI)
//   dev      → minimal + full demo data (default in development)
//   staging  → dev + extended demo data (QA / demos)
//   prod     → minimal only (production deploys)
// ============================================================

export type SeedProfile = 'minimal' | 'dev' | 'staging' | 'prod';

const VALID_PROFILES: SeedProfile[] = ['minimal', 'dev', 'staging', 'prod'];

/**
 * Resolve the active seed profile from the environment.
 * Defaults: development → dev, test/ci → minimal, production → prod.
 */
export function resolveProfile(): SeedProfile {
  const explicit = process.env.SEED_PROFILE as SeedProfile | undefined;
  if (explicit) {
    if (!VALID_PROFILES.includes(explicit)) {
      throw new Error(
        `Invalid SEED_PROFILE="${explicit}". Must be one of: ${VALID_PROFILES.join(', ')}`,
      );
    }
    return explicit;
  }

  const nodeEnv = process.env.NODE_ENV ?? 'development';
  if (nodeEnv === 'production') return 'prod';
  if (nodeEnv === 'test' || process.env.CI === 'true') return 'minimal';
  return 'dev';
}

/**
 * Guards against running dev/staging seeds in production.
 * Throws a clear error before any data is written.
 */
export function assertProfileAllowed(
  profile: SeedProfile,
  nodeEnv = process.env.NODE_ENV ?? 'development',
): void {
  const isDangerous = profile === 'dev' || profile === 'staging';
  const isProd = nodeEnv === 'production';

  if (isProd && isDangerous) {
    throw new Error(
      `\n╔════════════════════════════════════════════════════════╗\n` +
      `║  SEED SAFETY GUARD — OPERATION BLOCKED                 ║\n` +
      `╚════════════════════════════════════════════════════════╝\n` +
      `\n` +
      `Refusing to run SEED_PROFILE="${profile}" in NODE_ENV="${nodeEnv}".\n` +
      `\n` +
      `Fake users, merchants, and transactions must NEVER be seeded\n` +
      `in production. Use SEED_PROFILE=prod instead.\n`,
    );
  }

  if (profile === 'prod' && !isProd) {
    // Allowed but warn — running prod seed in dev is unusual
    console.warn(
      `[seed] ⚠️  Running SEED_PROFILE=prod in NODE_ENV="${nodeEnv}". ` +
      `Only essential catalog data will be seeded.`,
    );
  }
}

/**
 * Returns true if the given profile includes dev/staging data.
 */
export function isFullProfile(profile: SeedProfile): boolean {
  return profile === 'dev' || profile === 'staging';
}

/**
 * Returns true if the given profile includes staging-extended data.
 */
export function isStagingProfile(profile: SeedProfile): boolean {
  return profile === 'staging';
}
