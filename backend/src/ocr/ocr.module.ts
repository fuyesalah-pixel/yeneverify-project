// ============================================================
// Yene Verify — OCR Module
// Wire the OCR facade and its providers. Consumers (receipts,
// verifications) import this module and inject OcrService only.
// ============================================================

import { Module } from '@nestjs/common';
import { OcrService } from './ocr.service';
import { GoogleVisionProvider } from './providers/google-vision.provider';
import { MockProvider } from './providers/mock.provider';

@Module({
  providers: [OcrService, MockProvider, GoogleVisionProvider],
  exports: [OcrService],
})
export class OcrModule {}
