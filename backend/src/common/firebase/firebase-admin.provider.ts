import { Provider } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { AppConfigService } from '../../config/config.service';

export const FIREBASE_ADMIN = 'FIREBASE_ADMIN';

export const firebaseAdminProvider: Provider = {
  provide: FIREBASE_ADMIN,
  inject: [AppConfigService],
  useFactory: (config: AppConfigService) => {
    if (admin.apps.length > 0) return admin.app();
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!credentialsPath) {
      throw new Error('GOOGLE_APPLICATION_CREDENTIALS is not set');
    }
    return admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: config.firebaseProjectId,
    });
  },
};
