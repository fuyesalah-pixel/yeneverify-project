// ============================================================
// Yene Verify — Audit Module
// Global module providing AuditService.
// ============================================================

import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';

@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
