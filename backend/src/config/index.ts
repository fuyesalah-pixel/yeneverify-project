// Barrel exports for the typed configuration boundary.
export { AppConfigModule } from './config.module';
export { AppConfigService } from './config.service';
export { EnvironmentSecretProvider, SecretLoader } from './secret-loader.service';
export type { SecretProvider } from './secret-loader.service';
export {
  envSchema,
  validateEnv,
  formatEnvIssues,
  looksLikePlaceholder,
  PLACEHOLDER_MARKERS,
  SECRET_ENV_KEYS,
} from './env.schema';
export type { Env } from './env.schema';
