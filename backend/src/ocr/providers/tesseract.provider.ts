// ============================================================
// Yene Verify — Tesseract OCR Provider (local)
//
// Free, credential-free OCR for development and fixture generation.
// The worker is created lazily on the first recognize() call because
// loading the language model is the expensive part; it is reused
// until the module is destroyed. Environment validation rejects this
// provider outside development/test.
// ============================================================

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { createWorker, type Worker } from 'tesseract.js';
import { OcrProviderError } from '../../common/errors/domain-errors';
import { OcrProvider, OcrResult } from './ocr-provider.interface';

const LANGUAGE = 'eng';

@Injectable()
export class TesseractProvider implements OcrProvider, OnModuleDestroy {
  readonly name = 'tesseract' as const;

  private readonly logger = new Logger(TesseractProvider.name);
  private workerPromise: Promise<Worker> | null = null;

  async recognize(imageBuffer: Buffer, _mimeType: string): Promise<OcrResult> {
    const startedAt = Date.now();
    try {
      const worker = await this.worker();
      const { data } = await worker.recognize(imageBuffer);
      const text = data.text ?? '';
      if (!text.trim()) {
        throw new Error('tesseract returned no text for this image');
      }

      this.logger.log(
        `Tesseract OCR extracted ${text.length} chars in ${Date.now() - startedAt}ms`,
      );

      return {
        text,
        confidence: Math.min(1, Math.max(0, (data.confidence ?? 0) / 100)),
        provider: this.name,
        durationMs: Date.now() - startedAt,
      };
    } catch (error) {
      this.logger.error(`Tesseract OCR failed: ${String(error)}`);
      throw new OcrProviderError(this.name, String(error));
    }
  }

  async health(): Promise<boolean> {
    // Local engine: nothing to reach. Instantiation stays lazy so a readiness
    // probe never triggers the language-model download.
    return true;
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.workerPromise) return;
    const pending = this.workerPromise;
    this.workerPromise = null;
    try {
      const worker = await pending;
      await worker.terminate();
    } catch {
      // A worker that never started has nothing to clean up.
    }
  }

  /** Test seam: unit tests return an in-memory worker instead of spawning one. */
  protected spawnWorker(): Promise<Worker> {
    return createWorker(LANGUAGE);
  }

  private worker(): Promise<Worker> {
    if (!this.workerPromise) {
      this.workerPromise = this.spawnWorker().catch((error: unknown) => {
        // Allow the next call to retry after a transient model-download failure.
        this.workerPromise = null;
        throw error;
      });
    }
    return this.workerPromise;
  }
}
