import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// ============================================================
// Yene Verify — PrismaModule
//
// Global module — import once in AppModule, available everywhere.
//
// Usage in any module (no need to import PrismaModule again):
//   constructor(private readonly prisma: PrismaService) {}
// ============================================================

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
