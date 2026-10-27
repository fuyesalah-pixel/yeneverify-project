// ============================================================
// Yene Verify — Verification Module
//
// Owns the bank verification engine:
//
//   CbeAdapter — first real bank (13D.1)
//   TelebirrAdapter — headless-browser bank (13D.2)
//   AwashAdapter — HTTP HTML bank (13D.3)
//   DashenAdapter — flaky-endpoint bank with multi-URL fallback (13D.4)
//   AbyssiniaAdapter — supplementary account-suffix bank (13D.5)
//   MpesaAdapter — PDF-via-JSON bank (13D.6)
//   ZemenAdapter — direct-PDF bank (13D.7)
//   VerificationsService — pipeline orchestrator (13E.1)
//   VerdictResolver / DuplicateDetector / TransactionProjector — 13E.1
//   VerificationQueueService / VerificationProcessor — BullMQ (13E.2)
//   AdapterRegistry — bank routing (register/get/detectAll/detectBest)
//   BankAdapterMetrics — Redis counters for adapter outcomes
//
// The registry is built through a factory so each adapter provider
// stays a plain injectable (same pattern as OtpModule's OtpSender).
//
// The test-only StubAdapter is intentionally NOT provided or
// exported here; tests instantiate and register it programmatically.
// ============================================================

import { Global, Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ReceiptsModule } from '../receipts/receipts.module';
import { OcrModule } from '../ocr/ocr.module';
import { AdapterRegistry } from './adapters/adapter.registry';
import { BankAdapterMetrics } from './adapters/adapter.metrics';
import { BrowserPool } from './browser/browser-pool';
import { CbeAdapter } from './adapters/cbe/cbe.adapter';
import { TelebirrAdapter } from './adapters/telebirr/telebirr.adapter';
import { AwashAdapter } from './adapters/awash/awash.adapter';
import { DashenAdapter } from './adapters/dashen/dashen.adapter';
import { AbyssiniaAdapter } from './adapters/abyssinia/abyssinia.adapter';
import { MpesaAdapter } from './adapters/mpesa/mpesa.adapter';
import { ZemenAdapter } from './adapters/zemen/zemen.adapter';
import { VerificationsService } from './verifications/verifications.service';
import { VerificationsRepository } from './verifications/verifications.repository';
import { DuplicateDetector } from './verifications/duplicate-detector';
import { TransactionProjector } from './verifications/transaction-projector';
import { VerificationQueueService } from './queue/verification-queue.service';
import { VerificationProcessor } from './queue/verification.processor';
import { VerificationSubmitRateGuard } from './verifications/verification-submit-rate.guard';
import { VerificationsController } from './verifications/verifications.controller';

@Global()
@Module({
  imports: [HttpModule, ReceiptsModule, OcrModule],
  controllers: [VerificationsController],
  providers: [
    VerificationSubmitRateGuard,
    BrowserPool,
    CbeAdapter,
    TelebirrAdapter,
    AwashAdapter,
    DashenAdapter,
    AbyssiniaAdapter,
    MpesaAdapter,
    ZemenAdapter,
    VerificationsRepository,
    VerificationsService,
    DuplicateDetector,
    TransactionProjector,
    VerificationQueueService,
    VerificationProcessor,
    BankAdapterMetrics,
    {
      provide: AdapterRegistry,
      useFactory: (
        cbe: CbeAdapter,
        telebirr: TelebirrAdapter,
        awash: AwashAdapter,
        dashen: DashenAdapter,
        abyssinia: AbyssiniaAdapter,
        mpesa: MpesaAdapter,
        zemen: ZemenAdapter,
      ) => new AdapterRegistry(cbe, telebirr, awash, dashen, abyssinia, mpesa, zemen),
      inject: [
        CbeAdapter,
        TelebirrAdapter,
        AwashAdapter,
        DashenAdapter,
        AbyssiniaAdapter,
        MpesaAdapter,
        ZemenAdapter,
      ],
    },
  ],
  exports: [
    AdapterRegistry,
    BankAdapterMetrics,
    VerificationsRepository,
    VerificationsService,
    DuplicateDetector,
    TransactionProjector,
    VerificationQueueService,
  ],
})
export class VerificationModule {}
