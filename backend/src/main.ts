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
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Step-Up-Token', 'x-request-id'],
    exposedHeaders: ['x-request-id'],
  });

  // ── Routing ───────────────────────────────────────────────────────────
  app.setGlobalPrefix(cfg.runtime.apiPrefix, {
    // 'health/(.*)' keeps every health subpath (readiness + /health/ocr) off
    // the versioned prefix; listing paths individually 404s new ones.
    exclude: ['health', 'health/(.*)', 'docs', 'version', '/'],
  });

  app.enableVersioning({
    type: VersioningType.URI,
    // No defaultVersion: controllers opt in explicitly with `version: '1'`,
    // so prefix-excluded ops routes (health, version, root) are served at
    // their bare paths (/health, /version) instead of inheriting /v1.
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
