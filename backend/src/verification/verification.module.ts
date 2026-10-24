// ============================================================
// Yene Verify — Verification Module
//
// Owns the bank verification engine:
//
//   CbeAdapter — first real bank (13D.1)
//   TelebirrAdapter — headless-browser bank (13D.2)
//   AwashAdapter — HTTP HTML bank (13D.3)
//   DashenAdapter — flaky-endpoint bank with multi-URL fallback (13D.4)
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

@Global()
@Module({
  imports: [HttpModule],
  providers: [
    BrowserPool,
    CbeAdapter,
    TelebirrAdapter,
    AwashAdapter,
    DashenAdapter,
    BankAdapterMetrics,
    {
      provide: AdapterRegistry,
      useFactory: (
        cbe: CbeAdapter,
        telebirr: TelebirrAdapter,
        awash: AwashAdapter,
        dashen: DashenAdapter,
      ) => new AdapterRegistry(cbe, telebirr, awash, dashen),
      inject: [CbeAdapter, TelebirrAdapter, AwashAdapter, DashenAdapter],
    },
  ],
  exports: [AdapterRegistry, BankAdapterMetrics],
})
export class VerificationModule {}
