// ============================================================
// Yene Verify — Credits Jobs Module (14.3 Part B)
// Registers the BullMQ MAINTENANCE worker(s) owned by the credits
// feature. Split from CreditsModule so feature code that runs
// inside a Nest module without workers (e.g. unit-tested imports)
// does not silently start a Redis-backed worker.
// ============================================================

import { Module } from '@nestjs/common';
import { CreditsModule } from './credits.module';
import { ReconciliationJob } from './jobs/reconciliation.job';

@Module({
  imports: [CreditsModule],
  providers: [ReconciliationJob],
  exports: [ReconciliationJob],
})
export class CreditsJobsModule {}
