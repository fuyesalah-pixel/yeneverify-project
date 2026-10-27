// ============================================================
// Yene Verify — Credits Module
// The financial layer's service. No HTTP endpoints yet (14.2 hooks
// consume() into the verification processor; 14.3 wires the
// submission gate; 14.3+ may add read endpoints).
// ============================================================

import { Module } from '@nestjs/common';
import { CreditsService } from './credits.service';
import { CreditsRepository } from './credits.repository';

@Module({
  providers: [CreditsService, CreditsRepository],
  exports: [CreditsService, CreditsRepository],
})
export class CreditsModule {}
