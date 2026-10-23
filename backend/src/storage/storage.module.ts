import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { DriverRegistry } from './drivers/driver.registry';
import { LocalDriver } from './drivers/local.driver';
import { R2Driver } from './drivers/r2.driver';

@Global()
@Module({
  providers: [StorageService, DriverRegistry, LocalDriver, R2Driver],
  exports: [StorageService, DriverRegistry, LocalDriver],
})
export class StorageModule {}
