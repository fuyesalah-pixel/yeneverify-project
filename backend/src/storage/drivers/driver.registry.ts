// ============================================================
// Yene Verify — Storage Driver Registry
//
// Selects the active driver from STORAGE_DRIVER. Code never imports a
// driver directly — ask the registry, so switching drivers is a config
// change rather than a code change.
// ============================================================

import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../config/config.service';
import { LocalDriver } from './local.driver';
import { R2Driver } from './r2.driver';
import type { StorageDriver, StorageDriverName } from './storage-driver.interface';

@Injectable()
export class DriverRegistry {
  constructor(
    private readonly config: AppConfigService,
    private readonly local: LocalDriver,
    private readonly r2: R2Driver,
  ) {}

  active(): StorageDriver {
    return this.name() === 'r2' ? this.r2 : this.local;
  }

  name(): StorageDriverName {
    return this.config.storage.driver;
  }

  /** True when uploads are served by this backend rather than object storage. */
  isLocal(): boolean {
    return this.name() !== 'r2';
  }
}
