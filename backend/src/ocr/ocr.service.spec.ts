// ============================================================
// Yene Verify — OCR Unit Tests
//
// Covers the provider contract end to end without any network: the
// mock engine's determinism, provider selection from configuration,
// and Google Vision error wrapping (SDK stubbed via VISION_CLIENT).
// ============================================================

import { AppConfigService } from '../config/config.service';
import { OcrService } from './ocr.service';
import { GoogleVisionProvider } from './providers/google-vision.provider';
import { MockProvider } from './providers/mock.provider';
import { capRawPayload, OcrResult } from './providers/ocr-provider.interface';
import { createHash } from 'crypto';

const sha256 = (buf: Buffer) => createHash('sha256').update(buf).digest('hex');

/** Minimal AppConfigService stand-in exposing only what OCR reads. */
const configWith = (
  provider: 'mock' | 'google-vision',
  credentialsPath = '/run/secrets/gcp-vision.json',
) =>
  ({
    ocr: { provider },
    vision: {
      projectId: 'test-project',
      credentialsPath,
      credentialsJson: credentialsPath,
      timeoutMs: 15_000,
      maxImageBytes: 5_242_880,
      mock: false,
    },
  }) as unknown as AppConfigService;

describe('OcrService (unit)', () => {
  let mock: MockProvider;

  beforeEach(() => {
    mock = new MockProvider();
  });

  it('returns the fixture text deterministically for a known sha256', async () => {
    const image = Buffer.from('known-image-bytes');
    mock.addFixtures({
      [sha256(image)]: { text: 'CBE — transferred 250.00 ETB', confidence: 0.97 },
    });

    const result = await mock.recognize(image, 'image/jpeg');

    expect(result.text).toBe('CBE — transferred 250.00 ETB');
    expect(result.confidence).toBe(0.97);
    expect(result.provider).toBe('mock');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('returns the unmatched response for an unknown sha256', async () => {
    const result = await mock.recognize(Buffer.from('never-registered'), 'image/png');

    expect(result.text).toBe(`MOCK_OCR_UNMATCHED\nhash=${sha256(Buffer.from('never-registered'))}`);
    expect(result.confidence).toBe(0.0);
    expect(result.provider).toBe('mock');
  });

  it('is deterministic — the same image always yields the same text', async () => {
    const image = Buffer.from('repeatable');
    const first = await mock.recognize(image, 'image/jpeg');
    const second = await mock.recognize(image, 'image/jpeg');

    expect(second.text).toBe(first.text);
  });

  it('selects the mock provider when OCR_PROVIDER=mock', async () => {
    const service = new OcrService(configWith('mock'), mock, {} as never);
    expect(service.active().name).toBe('mock');
  });

  it('selects google-vision when OCR_PROVIDER=google-vision', async () => {
    // The real provider's constructor performs no I/O; the Vision client is
    // built lazily on first recognize() call.
    const vision = new GoogleVisionProvider(configWith('google-vision'));
    const service = new OcrService(configWith('google-vision'), mock, vision);
    expect(service.active().name).toBe('google-vision');
  });
});

describe('GoogleVisionProvider (unit, SDK stubbed)', () => {
  const okClient = {
    textDetection: jest.fn().mockResolvedValue([
      {
        fullTextAnnotation: {
          text: 'Commercial Bank of Ethiopia\nAmount: ETB 1,200.00',
          pages: [
            {
              blocks: [{ confidence: 0.9 }, { confidence: 0.8 }],
            },
          ],
        },
      },
      [],
    ]),
  };

  it('extracts full text and averages block confidence', async () => {
    const provider = new GoogleVisionProvider(configWith('google-vision'), okClient as never);

    const result: OcrResult = await provider.recognize(Buffer.from('img'), 'image/jpeg');

    expect(result.text).toContain('Amount: ETB 1,200.00');
    expect(result.confidence).toBeCloseTo(0.85, 5);
    expect(result.provider).toBe('google-vision');
  });

  it('wraps SDK failures in OCR_PROVIDER_ERROR (502)', async () => {
    const failingClient = {
      textDetection: jest.fn().mockRejectedValue(new Error('quota exceeded')),
    };
    const provider = new GoogleVisionProvider(configWith('google-vision'), failingClient as never);

    await expect(provider.recognize(Buffer.from('img'), 'image/jpeg')).rejects.toMatchObject({
      code: 'OCR_PROVIDER_ERROR',
      httpStatus: 502,
    });
  });

  it('falls back to the default confidence when no block confidences exist', async () => {
    const bareClient = {
      textDetection: jest
        .fn()
        .mockResolvedValue([{ fullTextAnnotation: { text: 'some text' } }, []]),
    };
    const provider = new GoogleVisionProvider(configWith('google-vision'), bareClient as never);

    const result = await provider.recognize(Buffer.from('img'), 'image/jpeg');
    expect(result.confidence).toBe(0.85);
  });
});

describe('capRawPayload', () => {
  it('keeps payloads under 5KB intact', () => {
    const value = { data: 'x'.repeat(1024) };
    expect(capRawPayload(value)).toBe(value);
  });

  it('truncates oversized payloads', () => {
    const value = { data: 'x'.repeat(10_000) };
    const capped = capRawPayload(value) as { truncated: string };
    expect(capped.truncated.length).toBeLessThanOrEqual(5 * 1024);
  });
});
