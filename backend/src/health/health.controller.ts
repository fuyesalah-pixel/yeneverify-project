import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { Public } from '../common/decorators/public.decorator';
import { OcrDiagnosticsService } from './ocr-diagnostics.service';
import { OcrHealthIndicator } from './indicators/ocr.health';
import { PrismaHealthIndicator } from './indicators/prisma.health';
import { RedisHealthIndicator } from './indicators/redis.health';
import { StorageHealthIndicator } from './indicators/storage.health';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
    private readonly redisIndicator: RedisHealthIndicator,
    private readonly storageIndicator: StorageHealthIndicator,
    private readonly ocrIndicator: OcrHealthIndicator,
    private readonly diagnostics: OcrDiagnosticsService,
  ) {}

  /**
   * GET /health
   * Liveness probe — no dependency checks.
   * Returns 200 as long as the process is running.
   */
  @Get()
  @Public()
  @ApiOperation({ summary: 'Liveness probe' })
  liveness() {
    return {
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * GET /health/ready
   * Readiness probe — checks Postgres, Redis, Storage, and OCR.
   * Returns 200 only when all dependencies are healthy. A mocked OCR engine
   * with zero fixtures still reports 200, but its entry is `degraded` with an
   * explicit message: the process is ready even though real receipts cannot
   * verify.
   */
  @Get('ready')
  @Public()
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness probe' })
  readiness() {
    return this.health.check([
      () => this.prismaIndicator.isHealthy('database'),
      () => this.redisIndicator.isHealthy('redis'),
      () => this.storageIndicator.isHealthy('storage'),
      () => this.ocrIndicator.isHealthy('ocr'),
    ]);
  }

  /**
   * GET /health/ocr
   * Development troubleshooting: active OCR provider, mock fixture count, and
   * whether this host can reach each bank endpoint. Consumed by the debug-only
   * banner on the mobile verify screen.
   */
  @Get('ocr')
  @Public()
  @ApiOperation({ summary: 'OCR + bank adapter diagnostics' })
  ocrDiagnostics() {
    return this.diagnostics.snapshot();
  }
}
