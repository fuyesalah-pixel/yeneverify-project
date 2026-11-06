// ============================================================
// Yene Verify — OCR fixture tooling (shared)
//
// Feeds backend/src/ocr/providers/mock-fixtures.json from real
// receipt images so the mock OCR engine can return the text a real
// OCR call would produce. Keyed by the sha256 of the EXACT bytes
// the mobile app uploads (q80, max 1600px), not the original photo.
//
// Text comes from a sidecar <image>.txt when present, otherwise from
// the configured engine: tesseract (local, free), google-vision
// (credentials required), or a loud failure for mock.
//
// Byte-exact caveat: the key is only reproducible when the bytes fed
// to this script are the bytes the app uploaded. Re-encoding here
// matches the app's *settings* (q80 / 1600px) but no JPEG encoder is
// byte-identical to another, so a hash taken from a re-encoded
// original will not match an upload. Use --no-compress with a copy of
// the uploaded object (bucket) when an exact match is required.
//
// Output discipline: prints hashes, counts and timings only — never
// OCR text, which may contain payer names and account numbers.
// ============================================================

import { createHash } from 'crypto';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { basename, dirname, extname, resolve } from 'path';
import { ImageAnnotatorClient, protos } from '@google-cloud/vision';
import Jimp from 'jimp';
import { createWorker, type Worker } from 'tesseract.js';

/** A single image → text entry in mock-fixtures.json. */
export interface MockFixture {
  text: string;
  confidence: number;
}

/** Confidence used when Vision annotates no block confidences. */
const DEFAULT_BLOCK_CONFIDENCE = 0.85;

/** Mirrors mobile/lib/features/verify/domain/image_prep.dart exactly. */
export const MAX_IMAGE_DIMENSION = 1600;
export const JPEG_QUALITY = 80;

/** Confidence recorded for text supplied by a sidecar file. */
export const SIDECAR_TEXT_CONFIDENCE = 0.95;

/** Bytes prepared for hashing, plus what changed on the way. */
export interface FixtureImage {
  bytes: Buffer;
  sha256: string;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  originalBytes: number;
  resized: boolean;
}

/**
 * Applies the mobile app's upload spec: JPEG q80, longest edge ≤ 1600px,
 * aspect ratio preserved, never upscaled.
 *
 * `--no-compress` skips re-encoding but still hashes the file as-is, which is
 * the only way to reproduce an already-uploaded object byte for byte.
 */
export async function prepareFixtureImage(
  original: Buffer,
  options: { compress?: boolean } = {},
): Promise<FixtureImage> {
  const compress = options.compress ?? true;

  let image: Jimp;
  try {
    image = await Jimp.read(original);
  } catch {
    throw new Error(
      'not a readable image (JPEG/PNG). Re-export the receipt, ' +
        'or pass --no-compress to hash the file as-is.',
    );
  }

  const originalWidth = image.bitmap.width;
  const originalHeight = image.bitmap.height;
  const longest = Math.max(originalWidth, originalHeight);
  const resized = longest > MAX_IMAGE_DIMENSION;

  if (!compress) {
    return {
      bytes: original,
      sha256: sha256Bytes(original),
      width: originalWidth,
      height: originalHeight,
      originalWidth,
      originalHeight,
      originalBytes: original.length,
      resized: false,
    };
  }

  if (resized) {
    // scaleToFit() is only reached when the image is too large, so this can
    // never upscale a small screenshot.
    image.scaleToFit(MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION);
  }
  const bytes = await image.quality(JPEG_QUALITY).getBufferAsync(Jimp.MIME_JPEG);

  return {
    bytes,
    sha256: sha256Bytes(bytes),
    width: image.bitmap.width,
    height: image.bitmap.height,
    originalWidth,
    originalHeight,
    originalBytes: original.length,
    resized,
  };
}

/** Human-readable compression line; contains no receipt text. */
export function describePreparation(prepared: FixtureImage): string {
  const before = `${prepared.originalWidth}×${prepared.originalHeight}`;
  if (prepared.resized) {
    return `${before} → ${prepared.width}×${prepared.height}, JPEG q${JPEG_QUALITY}`;
  }
  return `${before} → unchanged size, JPEG q${JPEG_QUALITY}`;
}

/**
 * Sidecar OCR text next to an image (`receipt.jpg` → `receipt.txt`).
 * Lets a developer generate a fixture from any OCR source without Vision.
 */
export function sidecarTextPath(imagePath: string): string {
  return resolve(dirname(imagePath), `${basename(imagePath, extname(imagePath))}.txt`);
}

export function readFixtureText(textPath: string): string {
  if (!existsSync(textPath)) {
    throw new Error(`text file not found: ${textPath}`);
  }
  const text = readFileSync(textPath, 'utf8').trim();
  if (!text) {
    throw new Error(`text file is empty: ${textPath}`);
  }
  return text;
}

/** Engines that can actually read a receipt image. */
export type FixtureOcrProvider = 'tesseract' | 'google-vision' | 'mock';

/** Shown whenever a fixture run produced nothing because no engine is set. */
export const FIXTURE_OCR_SETUP_HINT =
  'To generate fixtures, install OCR: set OCR_PROVIDER=tesseract (local, free) ' +
  'or provide VISION_CREDENTIALS_JSON (Vision API, paid).';

export function configuredFixtureProvider(): FixtureOcrProvider {
  const raw = (process.env.OCR_PROVIDER ?? 'mock').toLowerCase().trim();
  if (raw === 'tesseract' || raw === 'google-vision') return raw;
  return 'mock';
}

/** A source of OCR text for prepared image bytes. */
export interface FixtureTextSource {
  recognize(bytes: Buffer): Promise<MockFixture>;
  dispose?(): Promise<void>;
}

class TesseractFixtureTextSource implements FixtureTextSource {
  private workerPromise: Promise<Worker> | null = null;

  async recognize(bytes: Buffer): Promise<MockFixture> {
    const worker = await this.worker();
    const { data } = await worker.recognize(bytes);
    const text = (data.text ?? '').trim();
    if (!text) {
      throw new Error('tesseract returned no text for this image');
    }
    const confidence = Math.min(1, Math.max(0, (data.confidence ?? 0) / 100));
    return { text, confidence };
  }

  async dispose(): Promise<void> {
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

  private worker(): Promise<Worker> {
    if (!this.workerPromise) {
      this.workerPromise = createWorker('eng').catch((error: unknown) => {
        this.workerPromise = null;
        throw error;
      });
    }
    return this.workerPromise;
  }
}

/**
 * Creates the configured text source. Vision credentials resolve eagerly so
 * a missing file fails before any image is compressed.
 *
 * The mock engine ships no recognizer; failing loudly beats writing empty
 * text that later looks like a successful fixture.
 */
export function createFixtureTextSource(
  provider: FixtureOcrProvider = configuredFixtureProvider(),
): FixtureTextSource {
  if (provider === 'google-vision') {
    const client = createVisionClient(resolveVisionCredentials());
    return { recognize: (bytes) => recognizeWithVision(client, bytes) };
  }
  if (provider === 'tesseract') {
    return new TesseractFixtureTextSource();
  }
  throw new Error(
    `OCR_PROVIDER=mock has no recognizer, so fixture text cannot be generated. ` +
      `${FIXTURE_OCR_SETUP_HINT} Alternatively, put the OCR text in a sidecar ` +
      '<image>.txt file next to the image.',
  );
}

/** Documentation/comment keys in the fixture file (never hashes). */
const DOCUMENTATION_KEY_PREFIX = '_';

/**
 * Minimal .env loader. The scripts run outside Nest's ConfigModule, and adding
 * a dotenv dependency just for this would be heavier than four lines.
 * Existing process.env values always win.
 */
export function loadBackendEnv(): void {
  const candidates = [resolve(process.cwd(), '.env'), resolve(__dirname, '../../.env')];
  const envPath = candidates.find((path) => existsSync(path));
  if (!envPath) return;

  for (const rawLine of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

/** Path to the static fixture map, resolved from the backend root. */
export function fixturePath(override?: string): string {
  if (override) return resolve(override);

  const fromCwd = resolve(process.cwd(), 'src/ocr/providers/mock-fixtures.json');
  if (existsSync(fromCwd)) return fromCwd;
  return resolve(__dirname, '../../src/ocr/providers/mock-fixtures.json');
}

export function sha256Bytes(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

interface RawFixtureFile {
  [key: string]: unknown;
}

function readRawFixtureFile(override?: string): RawFixtureFile {
  const path = fixturePath(override);
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as RawFixtureFile;
  } catch (error) {
    throw new Error(`mock-fixtures.json is not valid JSON (${path}): ${(error as Error).message}`);
  }
}

/** Number of image hashes currently in the fixture map. */
export function fixtureCount(): number {
  return Object.keys(readRawFixtureFile()).filter(
    (key) => !key.startsWith(DOCUMENTATION_KEY_PREFIX),
  ).length;
}

/** Path to the committed documentation fixtures used by `--seed`. */
export function seedFixturePath(): string {
  const fromCwd = resolve(process.cwd(), 'src/ocr/providers/seed-fixtures.json');
  if (existsSync(fromCwd)) return fromCwd;
  return resolve(__dirname, '../../src/ocr/providers/seed-fixtures.json');
}

/**
 * Reads seed-fixtures.json. Entries are semantic keys, not image hashes, so
 * they exercise extraction/detection but never match a real upload. The
 * `note` field is documentation and is not copied into the fixture map.
 */
export function readSeedFixtures(path = seedFixturePath()): Record<string, MockFixture> {
  if (!existsSync(path)) {
    throw new Error(`seed fixtures not found: ${path}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`seed-fixtures.json is not valid JSON (${path}): ${(error as Error).message}`);
  }

  const entries: Record<string, MockFixture> = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (key.startsWith(DOCUMENTATION_KEY_PREFIX)) continue;
    const entry = value as Partial<MockFixture> | null;
    if (!entry || typeof entry.text !== 'string' || !entry.text.trim()) {
      throw new Error(`seed fixture ${key} has no text`);
    }
    if (typeof entry.confidence !== 'number') {
      throw new Error(`seed fixture ${key} has no numeric confidence`);
    }
    entries[key] = { text: entry.text, confidence: entry.confidence };
  }
  return entries;
}

/** Merges the committed seed fixtures into the mock map; returns the count. */
export function seedFixtures(
  options: { fixtureFile?: string; seedFile?: string } = {},
): number {
  const entries = readSeedFixtures(options.seedFile);
  const keys = Object.keys(entries).sort();
  for (const key of keys) {
    upsertFixture(key, entries[key], { path: options.fixtureFile });
  }
  return keys.length;
}

/**
 * Writes (or overwrites) one hash → {text, confidence} entry.
 * Idempotent: re-running with the same image produces the same file.
 * Written through a temp file so a crash never truncates the map.
 *
 * `path` lets tests target a throwaway file instead of the real map.
 */
export function upsertFixture(
  hash: string,
  fixture: MockFixture,
  options: { path?: string } = {},
): void {
  const path = fixturePath(options.path);
  const raw = readRawFixtureFile(options.path);

  const documentation: RawFixtureFile = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key.startsWith(DOCUMENTATION_KEY_PREFIX)) documentation[key] = value;
  }

  const hashes: Record<string, MockFixture> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!key.startsWith(DOCUMENTATION_KEY_PREFIX)) {
      hashes[key.toLowerCase()] = value as MockFixture;
    }
  }
  hashes[hash.toLowerCase()] = fixture;

  const sorted: RawFixtureFile = { ...documentation };
  for (const key of Object.keys(hashes).sort()) {
    sorted[key] = hashes[key];
  }

  const temporary = `${path}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');
  renameSync(temporary, path);
}

function averageBlockConfidence(
  annotation: protos.google.cloud.vision.v1.ITextAnnotation | null | undefined,
): number | null {
  const blocks = annotation?.pages?.flatMap((page) => page.blocks ?? []) ?? [];
  const confidences = blocks
    .map((block) => block.confidence)
    .filter((value): value is number => typeof value === 'number' && value > 0);
  if (confidences.length === 0) return null;
  return confidences.reduce((total, value) => total + value, 0) / confidences.length;
}

export function createVisionClient(credentialsPath: string): ImageAnnotatorClient {
  return new ImageAnnotatorClient({ keyFilename: credentialsPath });
}

/** Runs real Vision textDetection and returns fixture-shaped output. */
export async function recognizeWithVision(
  client: ImageAnnotatorClient,
  bytes: Buffer,
): Promise<MockFixture> {
  const [response] = await client.textDetection(bytes);
  const annotation = response.fullTextAnnotation;
  const text = annotation?.text ?? response.textAnnotations?.[0]?.description ?? '';
  if (!text.trim()) {
    throw new Error('Vision returned no text for this image');
  }
  return {
    text,
    confidence: averageBlockConfidence(annotation) ?? DEFAULT_BLOCK_CONFIDENCE,
  };
}

/** Resolves VISION_CREDENTIALS_JSON to a readable service-account file. */
export function resolveVisionCredentials(): string {
  const configured = process.env.VISION_CREDENTIALS_JSON;
  if (!configured) {
    throw new Error(
      'VISION_CREDENTIALS_JSON is not set. Point it at a GCP service-account JSON file ' +
        '(see backend/.env.example, "Dev OCR").',
    );
  }
  if (!existsSync(configured)) {
    throw new Error(`VISION_CREDENTIALS_JSON points at a missing file: ${configured}`);
  }
  return configured;
}

/** Ensures a path is a readable file before hashing it. */
export function requireReadableImage(imagePath: string): { path: string; bytes: Buffer } {
  if (!existsSync(imagePath)) {
    throw new Error(`image not found: ${imagePath}`);
  }
  const bytes = readFileSync(imagePath);
  if (bytes.length === 0) {
    throw new Error(`image is empty: ${imagePath}`);
  }
  return { path: imagePath, bytes };
}

export const SUPPORTED_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'] as const;

export function isSupportedImage(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return SUPPORTED_IMAGE_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

/** Directory of the fixture file, for user-facing output. */
export function fixtureDirectory(): string {
  return dirname(fixturePath());
}
