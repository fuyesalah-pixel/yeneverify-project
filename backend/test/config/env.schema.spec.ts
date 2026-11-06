import { envSchema, looksLikePlaceholder } from '../../src/config/env.schema';

function developmentEnvironment(): Record<string, unknown> {
  return {
    NODE_ENV: 'development',
    DATABASE_URL: 'postgresql://synthetic:synthetic@localhost:5432/synthetic',
    REDIS_URL: 'redis://localhost:6379',
    JWT_ACCESS_SECRET: 'x'.repeat(64),
    JWT_REFRESH_SECRET: 'y'.repeat(64),
  };
}

describe('envSchema', () => {
  it('accepts a development profile with optional cloud integrations omitted', () => {
    const result = envSchema.safeParse(developmentEnvironment());
    expect(result.success).toBe(true);
  });

  it('rejects a missing required database URL', () => {
    const env = developmentEnvironment();
    delete env.DATABASE_URL;
    const result = envSchema.safeParse(env);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === 'DATABASE_URL')).toBe(true);
    }
  });

  it('rejects malformed boolean values', () => {
    const result = envSchema.safeParse({
      ...developmentEnvironment(),
      AFROMESSAGE_MOCK: 'sometimes',
    });
    expect(result.success).toBe(false);
  });

  it('requires access and refresh signing secrets to differ', () => {
    const env = developmentEnvironment();
    env.JWT_REFRESH_SECRET = env.JWT_ACCESS_SECRET;
    const result = envSchema.safeParse(env);
    expect(result.success).toBe(false);
  });

  it('rejects mock adapters in hosted environments', () => {
    const result = envSchema.safeParse({
      ...developmentEnvironment(),
      NODE_ENV: 'staging',
      SENTRY_ENVIRONMENT: 'staging',
      AFROMESSAGE_MOCK: true,
    });
    expect(result.success).toBe(false);
  });

  it('recognizes obvious placeholder markers without printing their values', () => {
    expect(looksLikePlaceholder('replace_me_provider_key')).toBe(true);
    // A repeated filler character is itself a marker ("xxx"), so a key made
    // only of one character must never reach a hosted environment.
    expect(looksLikePlaceholder('x'.repeat(64))).toBe(true);
  });
});
