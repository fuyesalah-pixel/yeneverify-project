// ============================================================
// Yene Verify — Notifications Module (Step 15)
//
// Owns the FCM provider seam: the FCM_PROVIDER token is chosen
// once, here, from config (mock for dev/test, firebase for
// staging/prod). Nothing else imports firebase directly.
// ============================================================

import { Module } from '@nestjs/common';
import type { FcmProvider } from './fcm/fcm.provider';
import { AppConfigService } from '../config/config.service';
import { NotificationsService } from './notifications.service';
import { NotificationsRepository } from './notifications.repository';
import { FCM_PROVIDER } from './fcm/fcm.provider';
import { MockFcmProvider } from './fcm/fcm.provider.mock';
import { FirebaseFcmProvider } from './fcm/fcm.provider.firebase';
import { NotificationsController } from './notifications.controller';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsRepository,
    {
      provide: FCM_PROVIDER,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService): FcmProvider => {
        // FCM_PROVIDER takes precedence; FCM_MOCK pre-dates it and
        // still works for environments that only set the boolean.
        const explicit = config.fcm.provider;
        if (explicit === 'firebase') return new FirebaseFcmProvider(config);
        if (explicit === 'mock') return new MockFcmProvider();
        // Default behavior is unchanged from Step 14.3: FCM_MOCK=true
        // (default) → mock; FCM_MOCK=false → firebase credentials.
        return config.fcm.mock ? new MockFcmProvider() : new FirebaseFcmProvider(config);
      },
    },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
