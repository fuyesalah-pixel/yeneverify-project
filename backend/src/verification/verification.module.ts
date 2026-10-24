// ============================================================
// Yene Verify — Verification Module (framework stage)
//
// Ships the adapter framework only:
//
//   AdapterRegistry — bank routing (register/get/detectAll/detectBest)
//   BankAdapterMetrics — Redis counters for adapter outcomes
//
// Real adapters (CBE, Telebirr, ...) register themselves in
// tasks 13D.1–13D.7 by being added as providers here and passed
// to AdapterRegistry's constructor. No endpoints, no processor
// persistence — those arrive in 13E.
//
// The test-only StubAdapter is intentionally NOT provided or
// exported here; tests instantiate and register it programmatically.
// ============================================================

import { Global, Module } from '@nestjs/common';
import { AdapterRegistry } from './adapters/adapter.registry';
import { BankAdapterMetrics } from './adapters/adapter.metrics';

@Global()
@Module({
  providers: [BankAdapterMetrics, AdapterRegistry],
  exports: [AdapterRegistry, BankAdapterMetrics],
})
export class VerificationModule {}
