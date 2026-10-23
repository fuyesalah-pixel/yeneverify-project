// ============================================================
// Yene Verify — Google Vision OCR Provider
//
// Calls Cloud Vision textDetection on the image bytes and returns
// the full extracted text. Credentials come from the mounted
// service-account file (VISION_CREDENTIALS_JSON); nothing is
// hardcoded. Provider failures surface as OCR_PROVIDER_ERROR (502)
// so callers never leak SDK internals.
// ============================================================

import { promises as fs } from 'fs';
import { Injectable, Optional, Inject, Logger } from '@nestjs/common';
import { ImageAnnotatorClient, protos } from '@google-cloud/vision';
import { AppConfigService } from '../../config/config.service';
import { OcrProviderError } from '../../common/errors/domain-errors';
import { capRawPayload, OcrProvider, OcrResult } from './ocr-provider.interface';

/** Narrow client surface so unit tests can stub the SDK. */
type VisionTextDetectionClient = {
  textDetection(image: Buffer): Promise<[protos.google.cloud.vision.v1.IAnnotateImageResponse]>;
};

/** DI token for supplying a stubbed Vision client in unit tests. */
export const VISION_CLIENT = Symbol('VISION_CLIENT');

/** Confidence reported when Vision does not annotate block confidences. */
const DEFAULT_BLOCK_CONFIDENCE = 0.85;

function averageBlockConfidence(
  annotation: protos.google.cloud.vision.v1.ITextAnnotation | null | undefined,
): number | null {
  const blocks = annotation?.pages?.flatMap((page) => page.blocks ?? []) ?? [];
  const confidences: number[] = [];
  for (const block of blocks) {
    const confidence: number | null | undefined = block.confidence;
    if (typeof confidence === 'number' && confidence > 0) {
      confidences.push(confidence);
    }
  }
  if (confidences.length === 0) {
    return null;
  }
  const sum = confidences.reduce((total: number, value: number) => total + value, 0);
  return sum / confidences.length;
}

@Injectable()
export class GoogleVisionProvider implements OcrProvider {
  readonly name = 'google-vision' as const;

  private readonly logger = new Logger(GoogleVisionProvider.name);
  private lazyClient: VisionTextDetectionClient | null = null;

  constructor(
    private readonly config: AppConfigService,
    @Optional() @Inject(VISION_CLIENT) client?: VisionTextDetectionClient,
  ) {
    // Unit tests pass a stubbed client; production builds the real one lazily
    // so a missing credentials file never breaks application boot.
    this.lazyClient = client ?? null;
  }

  async recognize(imageBuffer: Buffer, _mimeType: string): Promise<OcrResult> {
    const startedAt = Date.now();
    try {
      const [response] = await this.client().textDetection(imageBuffer);
      const annotation = response.fullTextAnnotation ?? null;
      const text = annotation?.text ?? '';
      const confidence = averageBlockConfidence(annotation) ?? DEFAULT_BLOCK_CONFIDENCE;

      this.logger.log(`Vision OCR extracted ${text.length} chars in ${Date.now() - startedAt}ms`);

      return {
        text,
        confidence,
        provider: this.name,
        durationMs: Date.now() - startedAt,
        raw: capRawPayload(response),
      };
    } catch (err) {
      this.logger.error(`Vision OCR failed: ${String(err)}`);
      throw new OcrProviderError(this.name, String(err));
    }
  }

  async health(): Promise<boolean> {
    // Cheap readiness probe: the credentials file must exist and be readable.
    try {
      await fs.access(this.config.vision.credentialsPath);
      return true;
    } catch {
      return false;
    }
  }

  private client(): VisionTextDetectionClient {
    if (!this.lazyClient) {
      this.lazyClient = new ImageAnnotatorClient({
        projectId: this.config.vision.projectId || undefined,
        keyFilename: this.config.vision.credentialsPath || undefined,
      });
    }
    return this.lazyClient;
  }
}
