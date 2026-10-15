import { redactSensitiveData } from '../../src/common/logger/redact';
import { buildSentryBeforeSend } from '../../src/common/logger/sentry.config';
import { toSafeError } from '../../src/common/logger/safe-error';

/**
 * Security regression test for the Step 4 secret boundary.
 *
 * The marker is assembled at runtime and is not a credential. It stands in
 * for a provider value that must never reach a response or a log event.
 */
describe('secret leak boundary', () => {
  it('does not expose a secret in a known error response or log event', () => {
    const syntheticMarker = ['synthetic', 'redaction', 'marker'].join('-');

    const thrown = new Error(`provider rejected ${syntheticMarker}`);
    const response = toSafeError(thrown, 'request-test');
    const logEvent = redactSensitiveData(
      {
        message: `provider rejected ${syntheticMarker}`,
        request: {
          headers: { authorization: `Bearer ${syntheticMarker}` },
          body: { apiKey: syntheticMarker },
        },
        config: { database: { url: syntheticMarker } },
      },
      [syntheticMarker],
    );

    const responseText = JSON.stringify(response);
    const sentryEvent = buildSentryBeforeSend([syntheticMarker])({
      message: `provider rejected ${syntheticMarker}`,
      extra: { providerValue: syntheticMarker },
    });
    const sentryText = JSON.stringify(sentryEvent);
    const logText = JSON.stringify(logEvent);

    expect(responseText).not.toContain(syntheticMarker);
    expect(logText).not.toContain(syntheticMarker);
    expect(sentryText).not.toContain(syntheticMarker);
    expect(responseText).not.toContain('stack');
    expect(logText).not.toContain(syntheticMarker);
  });
});
