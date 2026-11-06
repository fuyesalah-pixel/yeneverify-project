// ============================================================
// Yene Verify — Mock OCR Provider (development)
//
// Deterministic, offline OCR. Text is derived from the image's
// sha256: registered fixtures win, everything else produces the
// stable MOCK_OCR_UNMATCHED response so pipelines have a predictable
// value to assert against.
//
// Never selected when OCR_PROVIDER=tesseract or google-vision, and
// environment validation rejects mock engines outside development/test.
// ============================================================

import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Injectable, Logger } from '@nestjs/common';
import { OcrProvider, OcrResult } from './ocr-provider.interface';

/** A known image → text entry in mock-fixtures.json. */
export interface MockFixture {
  text: string;
  confidence: number;
}

/** Unmatched images always report "no confidence". */
const UNMATCHED_CONFIDENCE = 0.0;

/**
 * Reads the static fixture map. Failures degrade to an empty map —
 * the mock engine must never break a boot just because a JSON file
 * is missing from a build output.
 */
function loadStaticFixtures(): Record<string, MockFixture> {
  try {
    const parsed: unknown = JSON.parse(
      readFileSync(resolve(__dirname, 'mock-fixtures.json'), 'utf8'),
    );
    // Keys starting with "_" are documentation keys (e.g. _comment), not hashes.
    const fixtures: Record<string, MockFixture> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, MockFixture>)) {
      if (!key.startsWith('_')) fixtures[key.toLowerCase()] = value;
    }
    return fixtures;
  } catch {
    return {};
  }
}

@Injectable()
export class MockProvider implements OcrProvider {
  readonly name = 'mock' as const;

  private readonly logger = new Logger(MockProvider.name);
  private readonly fixtures: Map<string, MockFixture>;

  constructor() {
    this.fixtures = new Map(Object.entries(loadStaticFixtures()));
    if (this.fixtures.size > 0) {
      this.logger.log(`Mock OCR fixtures loaded: ${this.fixtures.size} hashes`);
    }
  }

  /**
   * Number of image hashes the mock can resolve. Zero means every real
   * receipt degrades to MOCK_OCR_UNMATCHED, so verification cannot pass —
   * surfaced by /health/ready and /health/ocr.
   */
  get fixtureCount(): number {
    return this.fixtures.size;
  }

  /** Test seam: register expected image hashes without editing the static JSON. */
  addFixtures(entries: Record<string, MockFixture>): void {
    for (const [hash, fixture] of Object.entries(entries)) {
      this.fixtures.set(hash.toLowerCase(), fixture);
    }
  }

  async recognize(imageBuffer: Buffer, _mimeType: string): Promise<OcrResult> {
    const startedAt = Date.now();
    const sha256 = createHash('sha256').update(imageBuffer).digest('hex');

    const fixture = this.fixtures.get(sha256);
    const text = fixture?.text ?? `MOCK_OCR_UNMATCHED\nhash=${sha256}`;
    const confidence = fixture ? fixture.confidence : UNMATCHED_CONFIDENCE;

    this.logger.debug(`Mock OCR recognized ${sha256.slice(0, 12)}… (fixture=${Boolean(fixture)})`);

    return {
      text,
      confidence,
      provider: this.name,
      durationMs: Date.now() - startedAt,
    };
  }

  async health(): Promise<boolean> {
    // Deterministic in-memory engine — always ready.
    return true;
  }
}
