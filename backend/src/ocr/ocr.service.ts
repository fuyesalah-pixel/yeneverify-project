// ============================================================
// Yene Verify — OCR Service
//
// Facade over the configured OCR provider. Callers depend only on
// this service — never on a concrete provider — so swapping from the
// development mock to Google Vision stays a configuration change
// (OCR_PROVIDER=mock|google-vision). This layer never persists
// anything: storage of results lands in `verifications` in Step 13E.
// ============================================================

import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../config/config.service';
import { GoogleVisionProvider } from './providers/google-vision.provider';
import { MockProvider } from './providers/mock.provider';
import { OcrProvider, OcrResult } from './providers/ocr-provider.interface';

@Injectable()
export class OcrService {
  constructor(
    private readonly config: AppConfigService,
    private readonly mock: MockProvider,
    private readonly vision: GoogleVisionProvider,
  ) {}

  /** The provider selected by OCR_PROVIDER. */
  active(): OcrProvider {
    return this.config.ocr.provider === 'google-vision' ? this.vision : this.mock;
  }

  async recognize(imageBuffer: Buffer, mimeType: string): Promise<OcrResult> {
    return this.active().recognize(imageBuffer, mimeType);
  }

  async health(): Promise<boolean> {
    return this.active().health();
  }
}
