import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AppConfigService } from '../config';
import { QUEUE_NAMES } from './queue.constants';
import { QueueService } from './queue.service';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (cfg: AppConfigService) => ({
        connection: { url: cfg.redis.url },
        defaultJobOptions: {
          attempts: cfg.queue.jobAttempts,
          backoff: { type: 'exponential', delay: cfg.queue.backoffMs },
          removeOnComplete: { age: 3600, count: 1000 },
          removeOnFail: { age: 86400, count: 5000 },
        },
      }),
    }),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.VERIFICATION },
      { name: QUEUE_NAMES.NOTIFICATION },
      { name: QUEUE_NAMES.EXPORT },
      { name: QUEUE_NAMES.ANALYTICS },
      { name: QUEUE_NAMES.MAINTENANCE },
    ),
  ],
  providers: [QueueService],
  exports: [BullModule, QueueService],
})
export class QueueModule {}
