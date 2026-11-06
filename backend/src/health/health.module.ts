import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { OcrModule } from '../ocr/ocr.module';
import { HealthController } from './health.controller';
import { OcrDiagnosticsService } from './ocr-diagnostics.service';
import { OcrHealthIndicator } from './indicators/ocr.health';
import { PrismaHealthIndicator } from './indicators/prisma.health';
import { RedisHealthIndicator } from './indicators/redis.health';
import { StorageHealthIndicator } from './indicators/storage.health';

@Module({
  // OcrModule supplies OcrService + MockProvider for the OCR readiness check
  // and /health/ocr. AdapterRegistry comes from the global VerificationModule.
  imports: [TerminusModule, OcrModule],
  controllers: [HealthController],
  providers: [
    PrismaHealthIndicator,
    RedisHealthIndicator,
    StorageHealthIndicator,
    OcrHealthIndicator,
    OcrDiagnosticsService,
  ],
})
export class HealthModule {}
