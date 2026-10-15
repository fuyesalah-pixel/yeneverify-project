import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { validateEnv, type Env } from './env.schema';
import { AppConfigService } from './config.service';
import { EnvironmentSecretProvider, SecretLoader } from './secret-loader.service';

// ============================================================
// Yene Verify — AppConfigModule
//
// Global module — import once in AppModule. Nest loads local dotenv
// files, validates every value with Zod, and exposes only typed views.
// Hosted deployments inject process environment values through the
// platform (or a future secret-manager provider).
// ============================================================

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      envFilePath: ['.env', '.env.local'],
      // Never expand ${VAR}; expansion can accidentally copy secrets into
      // logs or into a derived configuration value.
      expandVariables: false,
      cache: true,
    }),
  ],
  providers: [
    EnvironmentSecretProvider,
    SecretLoader,
    {
      provide: AppConfigService,
      inject: [ConfigService, SecretLoader],
      useFactory: (rawConfig: ConfigService<Env, true>, secrets: SecretLoader) =>
        new AppConfigService(rawConfig, secrets),
    },
  ],
  exports: [AppConfigService, SecretLoader],
})
export class AppConfigModule {}
