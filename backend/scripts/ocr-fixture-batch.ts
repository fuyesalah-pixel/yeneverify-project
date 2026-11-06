// ============================================================
// Yene Verify — OCR fixtures (batch)
//
// Usage:  npm run ocr:fixture:batch -- <image-dir> [--no-compress]
//
// Processes every *.jpg / *.jpeg / *.png in a directory (non-recursive)
// with the same rules as ocr-fixture.ts: compress to the app's upload
// spec, hash the compressed bytes, OCR with Vision (or a sidecar .txt),
// and upsert into mock-fixtures.json in sorted order.
//
// A single bad image never aborts the run: it is reported as failed and
// the remaining files are still processed.
//
// Output discipline: file names, hashes and counts only — never the
// OCR text, which may contain PII.
// ============================================================

import { existsSync, readdirSync, statSync } from 'fs';
import { resolve } from 'path';
import type { ImageAnnotatorClient } from '@google-cloud/vision';
import {
  SIDECAR_TEXT_CONFIDENCE,
  assertFixtureTextSource,
  createVisionClient,
  loadBackendEnv,
  prepareFixtureImage,
  readFixtureText,
  recognizeWithVision,
  requireReadableImage,
  resolveVisionCredentials,
  sidecarTextPath,
  upsertFixture,
} from './lib/ocr-fixtures';

/** Batch input types are narrower than the single-image script on purpose. */
const BATCH_EXTENSIONS = ['.jpg', '.jpeg', '.png'] as const;

const USAGE = 'usage: ts-node scripts/ocr-fixture-batch.ts <image-dir> [--no-compress]';

export function isBatchImage(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return BATCH_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

export interface BatchOptions {
  compress: boolean;
  /** Target fixture map; defaults to src/ocr/providers/mock-fixtures.json. */
  fixtureFile?: string;
  /** Receives one line per image plus the summary; defaults to console.log. */
  log?: (line: string) => void;
}

export interface BatchResult {
  images: string[];
  written: number;
  failed: number;
}

/** Vision client, created once on first need; failures are sticky. */
class VisionTextSource {
  private client: ImageAnnotatorClient | null = null;
  private failure: Error | null = null;

  async recognize(bytes: Buffer): Promise<{ text: string; confidence: number }> {
    if (this.failure) throw this.failure;
    if (!this.client) {
      try {
        this.client = createVisionClient(resolveVisionCredentials());
      } catch (error) {
        this.failure = error as Error;
        throw this.failure;
      }
    }
    return recognizeWithVision(this.client, bytes);
  }
}

/**
 * Runs the batch over `directory`. Exported so tests can drive it without
 * spawning a process; the CLI wrapper below only parses argv.
 */
export async function runFixtureBatch(
  directory: string,
  options: BatchOptions,
): Promise<BatchResult> {
  const log = options.log ?? ((line: string) => console.log(line));
  const root = resolve(directory);
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    throw new Error(`not a directory: ${root}`);
  }

  const images = readdirSync(root)
    .filter(isBatchImage)
    .sort();

  if (images.length === 0) {
    log('Wrote 0 fixtures, 0 failed (see log)');
    return { images, written: 0, failed: 0 };
  }

  const vision = new VisionTextSource();
  let written = 0;
  let failed = 0;

  for (const [index, file] of images.entries()) {
    const prefix = `Processing ${index + 1}/${images.length}: ${file}...`;
    try {
      const imagePath = resolve(root, file);
      const { bytes } = requireReadableImage(imagePath);
      const prepared = await prepareFixtureImage(bytes, { compress: options.compress });

      const sidecar = sidecarTextPath(imagePath);
      const hasSidecar = existsSync(sidecar);
      assertFixtureTextSource(hasSidecar);
      const fixture = hasSidecar
        ? { text: readFixtureText(sidecar), confidence: SIDECAR_TEXT_CONFIDENCE }
        : await vision.recognize(prepared.bytes);

      upsertFixture(prepared.sha256, fixture, { path: options.fixtureFile });
      written += 1;
      log(`${prefix} done (text length=${fixture.text.length})`);
    } catch (error) {
      failed += 1;
      log(`${prefix} failed (${error instanceof Error ? error.message : String(error)})`);
    }
  }

  log(`Wrote ${written} fixtures, ${failed} failed (see log)`);
  return { images, written, failed };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }

  const compress = !argv.includes('--no-compress');
  const positional = argv.filter((arg) => !arg.startsWith('-'));
  if (positional.length !== 1) {
    console.error(`✖ expected exactly one directory\n${USAGE}`);
    process.exitCode = 1;
    return;
  }

  loadBackendEnv();
  const result = await runFixtureBatch(positional[0], { compress });
  if (result.failed > 0) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
