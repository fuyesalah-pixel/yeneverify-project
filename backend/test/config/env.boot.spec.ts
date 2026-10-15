import { validateEnv } from '../../src/config/env.schema';

describe('backend boot validation', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('requests a non-zero exit when a required variable is missing', () => {
    let requestedExitCode: number | undefined;
    jest.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      requestedExitCode = code;
      throw new Error('boot-stop');
    }) as never);

    expect(() => validateEnv({})).toThrow('boot-stop');
    expect(requestedExitCode).toBe(1);
  });

  it('requests a non-zero exit for a hosted placeholder secret', () => {
    const env = {
      NODE_ENV: 'staging',
      DATABASE_URL: 'postgresql://synthetic:replace_me@db.example.invalid/app',
      REDIS_URL: 'rediss://synthetic.example.invalid:6379',
      JWT_ACCESS_SECRET: 'x'.repeat(64),
      JWT_REFRESH_SECRET: 'y'.repeat(64),
      JWT_ISSUER: 'yene-verify',
      JWT_AUDIENCE: 'yene-verify-mobile',
      AFROMESSAGE_API_KEY: 'replace_me',
      VISION_PROJECT_ID: 'replace_me',
      R2_ACCOUNT_ID: 'replace_me',
      R2_ACCESS_KEY_ID: 'replace_me',
      R2_SECRET_ACCESS_KEY: 'replace_me',
      R2_ENDPOINT: 'https://replace_me.r2.example.invalid',
      R2_PUBLIC_BASE_URL: 'https://cdn.example.invalid',
      FCM_PROJECT_ID: 'replace_me',
      FCM_CLIENT_EMAIL: 'replace_me@example.invalid',
      FCM_PRIVATE_KEY: 'replace_me',
      SENTRY_DSN: 'https://replace_me@example.invalid/1',
      SENTRY_ENVIRONMENT: 'staging',
      AFROMESSAGE_MOCK: false,
      VISION_MOCK: false,
      FCM_MOCK: false,
      BANK_ADAPTER_MOCK: false,
      R2_USE_MINIO: false,
    };
    let requestedExitCode: number | undefined;
    jest.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      requestedExitCode = code;
      throw new Error('boot-stop');
    }) as never);

    expect(() => validateEnv(env)).toThrow('boot-stop');
    expect(requestedExitCode).toBe(1);
  });
});
