import { NestFactory } from '@nestjs/core';
import { VersioningType } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppConfigService } from './config/config.service';
import { setupSwagger } from './swagger/swagger.setup';

// ============================================================
// Yene Verify — Application Bootstrap
//
// Boot sequence:
//   1. Create NestJS app
//   2. Apply security middleware (helmet, CORS)
//   3. Set global prefix + URI versioning
//   4. Setup Swagger (dev/staging only)
//   5. Enable graceful shutdown hooks
//   6. Listen
// ============================================================

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Use nestjs-pino as the NestJS logger
  app.useLogger(app.get(Logger));

  const cfg = app.get(AppConfigService);

  // ── Security ─────────────────────────────────────────────────────────
  app.use(helmet());
  app.enableCors({
    origin: cfg.cors.origins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
    exposedHeaders: ['x-request-id'],
  });

  // ── Routing ───────────────────────────────────────────────────────────
  app.setGlobalPrefix(cfg.runtime.apiPrefix, {
    exclude: ['health', 'health/ready', 'docs', 'version', '/'],
  });

  app.enableVersioning({
    type: VersioningType.URI,
    // Nest prepends "v" for URI versioning, so a configured "v1" would
    // become the "/vv1/..." segment. Accept both spellings.
    defaultVersion: cfg.runtime.apiVersion.replace(/^v/i, ''),
  });

  // ── API docs (skipped in production) ─────────────────────────────────
  setupSwagger(app, cfg);

  // ── Graceful shutdown ─────────────────────────────────────────────────
  app.enableShutdownHooks();

  // ── Listen ────────────────────────────────────────────────────────────
  await app.listen(cfg.runtime.port, cfg.runtime.host);

  app
    .get(Logger)
    .log(
      `Yene Verify started — port=${cfg.runtime.port} env=${cfg.runtime.nodeEnv} ` +
        `docs=${cfg.runtime.isProd ? 'disabled' : `http://localhost:${cfg.runtime.port}/docs`}`,
      'Bootstrap',
    );
}

void bootstrap();
