// ============================================================
// Yene Verify — Biometric Module
// ============================================================

import { Module } from '@nestjs/common';
import { BiometricService } from './biometric.service';
import { BiometricRepository } from './biometric.repository';

@Module({
  providers: [BiometricService, BiometricRepository],
  exports: [BiometricService, BiometricRepository],
})
export class BiometricModule {}
