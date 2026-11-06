// ============================================================
// Yene Verify — OCR Service
//
// Facade over the configured OCR provider. Callers depend only on
// this service — never on a concrete provider — so swapping between the
// mock, local Tesseract and Google Vision stays a configuration change
// (OCR_PROVIDER=mock|tesseract|google-vision). This layer never persists
// anything: storage of results lands in `verifications` in Step 13E.
// ============================================================

import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../config/config.service';
import { GoogleVisionProvider } from './providers/google-vision.provider';
import { MockProvider } from './providers/mock.provider';
import { OcrProvider, OcrResult } from './providers/ocr-provider.interface';
import { TesseractProvider } from './providers/tesseract.provider';

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly mock: MockProvider,
    private readonly vision: GoogleVisionProvider,
    private readonly tesseract: TesseractProvider,
  ) {}

  /** The provider selected by OCR_PROVIDER. */
  active(): OcrProvider {
    switch (this.config.ocr.provider) {
      case 'google-vision':
        return this.vision;
      case 'tesseract':
        return this.tesseract;
      default:
        return this.mock;
    }
  }

  /**
   * Runs the configured provider. When Google Vision fails (quota,
   * auth, transient network), Tesseract is the last-resort fallback so
   * a receipt is not lost to a cloud outage; mock/tesseract failures
   * surface as-is.
   */
  async recognize(imageBuffer: Buffer, mimeType: string): Promise<OcrResult> {
    const provider = this.active();
    try {
      return await provider.recognize(imageBuffer, mimeType);
    } catch (err) {
      if (this.config.ocr.provider !== 'google-vision') {
        throw err;
      }
      this.logger.warn(
        `Google Vision OCR failed (${err instanceof Error ? err.message : 'unknown'}) — falling back to Tesseract`,
      );
      return this.tesseract.recognize(imageBuffer, mimeType);
    }
  }

  async health(): Promise<boolean> {
    return this.active().health();
  }
}
