// ============================================================
// Yene Verify — Packages Module (Step 17)
//
// Read-only catalog + subscription state. Depends only on the
// global PrismaModule — no credits/notifications coupling: this
// module never mutates anything and never notifies anyone.
// ============================================================

import { Module } from '@nestjs/common';
import { PackagesController } from './packages.controller';
import { PackagesService } from './packages.service';
import { PackagesRepository } from './packages.repository';

@Module({
  controllers: [PackagesController],
  providers: [PackagesService, PackagesRepository],
})
export class PackagesModule {}
