// ============================================================
// Yene Verify — Verification Module
//
// Owns the bank verification engine:
//
//   CbeAdapter — first real bank (13D.1); more arrive in 13D.2–13D.7
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
import { CbeAdapter } from './adapters/cbe/cbe.adapter';

@Global()
@Module({
  imports: [HttpModule],
  providers: [
    CbeAdapter,
    BankAdapterMetrics,
    {
      provide: AdapterRegistry,
      useFactory: (cbe: CbeAdapter) => new AdapterRegistry(cbe),
      inject: [CbeAdapter],
    },
  ],
  exports: [AdapterRegistry, BankAdapterMetrics],
})
export class VerificationModule {}
