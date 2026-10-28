// ============================================================
// Yene Verify — FCM Provider Tests (Step 15)
//
// MockFcmProvider: never throws, records invocations, masks tokens.
// FirebaseFcmProvider: maps firebase-admin error codes to the typed
// FCM errors and expands the escaped "\\n" inside the private key
// BEFORE cert() sees it (the class of failure Watch #4 predicted).
//
// firebase-admin is mocked at the module boundary: initializing a
// real app would need valid service-account credentials.
// ============================================================

import { Logger } from '@nestjs/common';
import { MockFcmProvider } from './fcm.provider.mock';
import { FirebaseFcmProvider } from './fcm.provider.firebase';
import { AppConfigService } from '../../config/config.service';
import { FcmSendError, FcmTokenInvalidError } from './fcm.errors';

jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

// No real firebase-admin app is ever constructed in these tests.
const messagingMock = { send: jest.fn() };
const initializeAppMock = jest.fn((_opts: unknown, _name: string) => ({ __mockApp: true }));
const getMessagingMock = jest.fn((_app: unknown) => messagingMock);
const certMock = jest.fn((opts: unknown) => ({ __cert: opts }));

jest.mock('firebase-admin/app', () => ({
  __esModule: true,
  initializeApp: (opts: unknown, name: string) => initializeAppMock(opts, name),
  cert: (opts: unknown) => certMock(opts),
}));
jest.mock('firebase-admin/messaging', () => ({
  __esModule: true,
  getMessaging: (app: unknown) => getMessagingMock(app),
}));

const CONFIG = {
  fcm: {
    projectId: 'proj-1',
    clientEmail: 'push@app.iam',
    privateKey: '-----BEGIN PRIVATE KEY-----\\nline1\\nline2\\n-----END PRIVATE KEY-----\\n',
  },
} as const;

function makeFirebaseProvider(): FirebaseFcmProvider {
  return new FirebaseFcmProvider(CONFIG as unknown as AppConfigService);
}

describe('MockFcmProvider', () => {
  it('always delivers and records what it was given', async () => {
    const mock = new MockFcmProvider();
    const result = await mock.send({
      token: 'aaaa1111bbbb2222',
      title: 'Payment verified',
      body: 'ok',
      data: { verificationId: 'v-1' },
    });

    expect(result.messageId).toMatch(/^mock-/);
    expect(mock.sent).toHaveLength(1);
    expect(mock.sent[0]).toMatchObject({
      title: 'Payment verified',
      body: 'ok',
      data: { verificationId: 'v-1' },
    });
  });

  it('health() is always true and send() never throws', async () => {
    const mock = new MockFcmProvider();
    await expect(mock.health()).resolves.toBe(true);
    await expect(mock.send({ token: '', title: '', body: '' })).resolves.toHaveProperty(
      'messageId',
    );
  });
});

describe('FirebaseFcmProvider', () => {
  beforeEach(() => {
    messagingMock.send.mockReset();
    initializeAppMock.mockClear();
    certMock.mockClear();
    getMessagingMock.mockClear();
  });

  it('normalizes escaped \\n in the private key before cert() receives it', async () => {
    const provider = makeFirebaseProvider();
    messagingMock.send.mockResolvedValue('projects/p/messages/1');
    await provider.send({ token: 'tok', title: 't', body: 'b' });

    expect(initializeAppMock).toHaveBeenCalledWith(expect.anything(), 'yene-verify');
    const certInput = certMock.mock.calls[0][0] as { privateKey: string };
    // cert() must see REAL newlines — the escaped variant fails its
    // signature check with a cryptic "invalid private key" error.
    expect(certInput.privateKey).toContain('\n');
    expect(certInput.privateKey).not.toContain('\\n');
  });

  it('sends the high-priority notification payload with the FCM data map', async () => {
    const provider = makeFirebaseProvider();
    messagingMock.send.mockResolvedValue('projects/p/messages/msg-9');
    await provider.send({
      token: 'tok-1',
      title: 'Payment verified',
      body: 'ok',
      data: { verificationId: 'v-1', type: 'VERIFICATION_RESULT' },
    });

    expect(messagingMock.send).toHaveBeenCalledWith({
      token: 'tok-1',
      notification: { title: 'Payment verified', body: 'ok' },
      data: { verificationId: 'v-1', type: 'VERIFICATION_RESULT' },
      android: { priority: 'high' },
      apns: { headers: { 'apns-priority': '10' } },
    });
  });

  it('maps messaging/registration-token-not-registered to FcmTokenInvalidError', async () => {
    const provider = makeFirebaseProvider();
    messagingMock.send.mockRejectedValue(
      Object.assign(new Error('Requested entity was not found.'), {
        code: 'messaging/registration-token-not-registered',
      }),
    );

    await expect(provider.send({ token: 'dead', title: 't', body: 'b' })).rejects.toBeInstanceOf(
      FcmTokenInvalidError,
    );
  });

  it('maps messaging/invalid-argument to FcmSendError', async () => {
    const provider = makeFirebaseProvider();
    messagingMock.send.mockRejectedValue(
      Object.assign(new Error('Invalid arg'), { code: 'messaging/invalid-argument' }),
    );

    await expect(provider.send({ token: 't', title: 't', body: 'b' })).rejects.toThrow(
      /Invalid arg/,
    );
  });

  it('maps any other firebase failure to a generic FcmSendError', async () => {
    const provider = makeFirebaseProvider();
    messagingMock.send.mockRejectedValue(
      Object.assign(new Error('backend down'), { code: 'messaging/server-error' }),
    );

    await expect(provider.send({ token: 't', title: 't', body: 'b' })).rejects.toBeInstanceOf(
      FcmSendError,
    );
  });

  it('health() reports false when the firebase app cannot be initialized', async () => {
    const provider = makeFirebaseProvider();
    // Blank credentials make messaging() throw its config guard.
    const bad = new FirebaseFcmProvider({
      fcm: { projectId: '', clientEmail: '', privateKey: '' },
    } as unknown as AppConfigService);
    await expect(bad.health()).resolves.toBe(false);
    await expect(provider.health()).resolves.toBe(true);
  });
});
