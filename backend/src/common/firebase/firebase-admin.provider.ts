import { Provider } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { AppConfigService } from '../../config/config.service';

export const FIREBASE_ADMIN = 'FIREBASE_ADMIN';

export const firebaseAdminProvider: Provider = {
  provide: FIREBASE_ADMIN,
  inject: [AppConfigService],
  useFactory: (config: AppConfigService) => {
    if (admin.apps.length > 0) return admin.app();
    // verifyIdToken validates against Google's public certs and needs no
    // service-account credential; only token-minting ops require one.
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    return admin.initializeApp({
      ...(credentialsPath
        ? { credential: admin.credential.applicationDefault() }
        : {}),
      projectId: config.firebaseProjectId,
    });
  },
};
