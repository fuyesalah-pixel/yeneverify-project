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

@Global()
@Module({
  imports: [HttpModule],
  providers: [
    BrowserPool,
    CbeAdapter,
    TelebirrAdapter,
    AwashAdapter,
    DashenAdapter,
    AbyssiniaAdapter,
    MpesaAdapter,
    ZemenAdapter,
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
  exports: [AdapterRegistry, BankAdapterMetrics],
})
export class VerificationModule {}
