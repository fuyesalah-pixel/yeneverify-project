// ============================================================
// Yene Verify — OCR fixture tooling (unit)
//
// Pins the rules that make a fixture usable: the key is the sha256 of
// the COMPRESSED upload bytes (q80 / 1600px), the map stays sorted for
// stable diffs, and one broken file never aborts a batch run.
// ============================================================

import { createHash } from 'crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import Jimp from 'jimp';
import {
  FIXTURE_OCR_SETUP_HINT,
  JPEG_QUALITY,
  MAX_IMAGE_DIMENSION,
  prepareFixtureImage,
  readSeedFixtures,
  sha256Bytes,
  upsertFixture,
} from '../../scripts/lib/ocr-fixtures';
import { isBatchImage, runFixtureBatch, runSeed } from '../../scripts/ocr-fixture-batch';

const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

// Pure-JS image decode/encode is slow in CI; these are I/O-shaped tests,
// not hot-path tests.
jest.setTimeout(30_000);

function temporaryDirectory(): string {
  return mkdtempSync(join(tmpdir(), 'yene-ocr-fixture-'));
}

async function jpeg(width: number, height: number, quality = 100): Promise<Buffer> {
  const image = new Jimp(width, height, 0x336699ff);
  // Real receipts are not a flat colour; a little variation keeps the
  // q80 re-encode from being byte-identical to the input.
  for (let x = 0; x < width; x += 7) {
    image.setPixelColor(((x * 2654435761) >>> 8) | 0xff, x % width, (x * 3) % height);
  }
  return image.quality(quality).getBufferAsync(Jimp.MIME_JPEG);
}

describe('prepareFixtureImage (compression spec)', () => {
  it('caps the longest edge at 1600px and preserves the aspect ratio', async () => {
    const original = await jpeg(2000, 500);
    const prepared = await prepareFixtureImage(original);

    expect(MAX_IMAGE_DIMENSION).toBe(1600);
    expect(JPEG_QUALITY).toBe(80);
    expect(prepared.resized).toBe(true);
    expect(prepared.width).toBe(1600);
    expect(prepared.height).toBe(400);
    expect(prepared.originalWidth).toBe(2000);
    expect(prepared.originalHeight).toBe(500);
  });

  it('never upscales an image that already fits', async () => {
    const original = await jpeg(640, 480);
    const prepared = await prepareFixtureImage(original);

    expect(prepared.resized).toBe(false);
    expect(prepared.width).toBe(640);
    expect(prepared.height).toBe(480);
  });

  it('hashes the compressed bytes, not the original', async () => {
    const original = await jpeg(2000, 1000);
    const prepared = await prepareFixtureImage(original);

    expect(prepared.bytes.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
    expect(prepared.sha256).toBe(sha256Bytes(prepared.bytes));
    expect(prepared.sha256).toBe(sha256(prepared.bytes));
    expect(prepared.sha256).not.toBe(sha256(original));
  });

  it('--no-compress keeps the uploaded bytes and their hash intact', async () => {
    const original = await jpeg(2000, 1000);
    const prepared = await prepareFixtureImage(original, { compress: false });

    expect(prepared.resized).toBe(false);
    expect(prepared.bytes.equals(original)).toBe(true);
    expect(prepared.sha256).toBe(sha256(original));
  });
});

describe('upsertFixture (stable file)', () => {
  let root: string;
  let fixtures: string;

  beforeEach(() => {
    root = temporaryDirectory();
    fixtures = join(root, 'mock-fixtures.json');
    writeFileSync(fixtures, '{"_comment":"keep me"}\n', 'utf8');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('writes image hashes in sorted order and keeps documentation keys', () => {
    upsertFixture('ffff', { text: 'c', confidence: 0.9 }, { path: fixtures });
    upsertFixture('aaaa', { text: 'a', confidence: 0.9 }, { path: fixtures });
    upsertFixture('cccc', { text: 'b', confidence: 0.9 }, { path: fixtures });

    const written = JSON.parse(readFileSync(fixtures, 'utf8'));
    expect(Object.keys(written)).toEqual(['_comment', 'aaaa', 'cccc', 'ffff']);
  });

  it('is idempotent — re-running with the same image changes nothing', () => {
    upsertFixture('bbbb', { text: 'same', confidence: 0.8 }, { path: fixtures });
    const first = readFileSync(fixtures, 'utf8');
    upsertFixture('bbbb', { text: 'same', confidence: 0.8 }, { path: fixtures });
    const second = readFileSync(fixtures, 'utf8');

    expect(second).toBe(first);
  });
});

describe('runFixtureBatch', () => {
  let root: string;
  let fixtures: string;

  beforeEach(() => {
    root = temporaryDirectory();
    fixtures = join(root, 'mock-fixtures.json');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('only accepts jpg/jpeg/png files', () => {
    expect(isBatchImage('a.jpg')).toBe(true);
    expect(isBatchImage('b.JPEG')).toBe(true);
    expect(isBatchImage('c.png')).toBe(true);
    expect(isBatchImage('d.webp')).toBe(false);
    expect(isBatchImage('notes.txt')).toBe(false);
  });

  it('skips non-images and processes every image (non-recursive)', async () => {
    writeFileSync(join(root, 'a.jpg'), await jpeg(800, 600));
    writeFileSync(join(root, 'a.txt'), 'text for a');
    writeFileSync(join(root, 'b.png'), await jpeg(400, 300));
    writeFileSync(join(root, 'b.txt'), 'text for b');
    writeFileSync(join(root, 'notes.md'), 'not an image');

    const lines: string[] = [];
    const result = await runFixtureBatch(root, {
      compress: true,
      fixtureFile: fixtures,
      log: (line) => lines.push(line),
    });

    expect(result.images).toEqual(['a.jpg', 'b.png']);
    expect(result.written).toBe(2);
    expect(result.failed).toBe(0);
    expect(lines).toContain('Processing 1/2: a.jpg... done (text length=10)');
    expect(lines).toContain('Processing 2/2: b.png... done (text length=10)');
    expect(lines).toContain('Wrote 2 fixtures, 0 failed (see log)');

    const written = JSON.parse(readFileSync(fixtures, 'utf8'));
    expect(Object.keys(written)).toHaveLength(2);
  });

  it('explains how to enable OCR when nothing could be read', async () => {
    writeFileSync(join(root, 'a.jpg'), await jpeg(400, 300));

    const lines: string[] = [];
    const result = await runFixtureBatch(root, {
      compress: true,
      fixtureFile: fixtures,
      log: (line) => lines.push(line),
      textSource: {
        recognize: async () => {
          throw new Error('no engine configured');
        },
      },
    });

    expect(result.written).toBe(0);
    expect(result.failed).toBe(1);
    expect(lines[lines.length - 1]).toBe(`Wrote 0 fixtures, 1 failed. ${FIXTURE_OCR_SETUP_HINT}`);
  });

  it('continues after one broken image and reports the failure', async () => {
    writeFileSync(join(root, 'a-broken.jpg'), 'definitely not a jpeg');
    writeFileSync(join(root, 'b-good.jpg'), await jpeg(800, 600));
    writeFileSync(join(root, 'b-good.txt'), 'text for the good one');

    const lines: string[] = [];
    const result = await runFixtureBatch(root, {
      compress: true,
      fixtureFile: fixtures,
      log: (line) => lines.push(line),
    });

    expect(result.written).toBe(1);
    expect(result.failed).toBe(1);
    expect(lines.some((line) => line.includes('a-broken.jpg... failed'))).toBe(true);
    expect(lines).toContain('Processing 2/2: b-good.jpg... done (text length=21)');
    expect(lines).toContain('Wrote 1 fixtures, 1 failed (see log)');
  });
});

describe('seed fixtures (--seed)', () => {
  let root: string;
  let fixtures: string;

  beforeEach(() => {
    root = temporaryDirectory();
    fixtures = join(root, 'mock-fixtures.json');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('ships 7 documentation entries with text and confidence', () => {
    const entries = readSeedFixtures();

    expect(Object.keys(entries)).toHaveLength(7);
    for (const entry of Object.values(entries)) {
      expect(entry.text.trim().length).toBeGreaterThan(0);
      expect(entry.confidence).toBeGreaterThan(0);
    }
  });

  it('merges every entry into the map and logs the count', () => {
    const lines: string[] = [];
    const seeded = runSeed({ fixtureFile: fixtures, log: (line) => lines.push(line) });

    expect(seeded).toBe(7);
    expect(lines).toEqual(['Seeded 7 fixtures (these are documentation samples, not real OCR)']);

    const written = JSON.parse(readFileSync(fixtures, 'utf8'));
    expect(Object.keys(written)).toHaveLength(7);
    expect(written['test-cbe-001'].text).toContain('Commercial Bank of Ethiopia');
    // Documentation-only field is not copied into the runtime map.
    expect(written['test-cbe-001'].note).toBeUndefined();
  });

  it('is idempotent — running --seed twice changes nothing', () => {
    runSeed({ fixtureFile: fixtures, log: () => undefined });
    const first = readFileSync(fixtures, 'utf8');
    runSeed({ fixtureFile: fixtures, log: () => undefined });

    expect(readFileSync(fixtures, 'utf8')).toBe(first);
  });
});
