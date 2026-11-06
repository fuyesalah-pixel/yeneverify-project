// ============================================================
// Yene Verify — OCR fixture (single image)
//
// Usage:  npm run ocr:fixture -- <image-path> [options]
//
//   --no-compress        hash the file as-is (use for an object that
//                        was already uploaded by the app)
//   --text-file <path>   OCR text captured elsewhere (sidecar .txt is
//                        picked up automatically)
//   --confidence <0..1>  override the recorded confidence
//
// By default the image is re-encoded exactly like the mobile app
// (JPEG q80, longest edge 1600px, aspect preserved) and the sha256 of
// those compressed bytes becomes the fixture key.
//
// OCR text comes from Google Vision when OCR_PROVIDER=google-vision,
// otherwise from a sidecar <image>.txt — the mock engine has no
// recognizer and this script fails loudly rather than writing empty
// text.
//
// Output discipline: hash, dimensions, byte counts and text length
// only — never the OCR text, which may contain payer names and
// account numbers.
// ============================================================

import { existsSync } from 'fs';
import { basename } from 'path';
import {
  SIDECAR_TEXT_CONFIDENCE,
  assertFixtureTextSource,
  createVisionClient,
  describePreparation,
  loadBackendEnv,
  prepareFixtureImage,
  readFixtureText,
  recognizeWithVision,
  requireReadableImage,
  resolveVisionCredentials,
  sidecarTextPath,
  upsertFixture,
} from './lib/ocr-fixtures';

interface Options {
  imagePath: string;
  compress: boolean;
  textFile: string | null;
  confidence: number | null;
}

const USAGE = `usage: ts-node scripts/ocr-fixture.ts <image-path> [--no-compress] [--text-file <path>] [--confidence <0..1>]`;

function parseArgs(argv: string[]): Options | null {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    return null;
  }

  let imagePath: string | null = null;
  let compress = true;
  let textFile: string | null = null;
  let confidence: number | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--no-compress') {
      compress = false;
    } else if (arg === '--text-file') {
      textFile = argv[index + 1] ?? null;
      index += 1;
    } else if (arg === '--confidence') {
      const raw = argv[index + 1];
      const parsed = raw === undefined ? Number.NaN : Number(raw);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
        throw new Error(`--confidence must be a number between 0 and 1 (got ${String(raw)})`);
      }
      confidence = parsed;
      index += 1;
    } else if (arg.startsWith('-')) {
      throw new Error(`unknown option: ${arg}\n${USAGE}`);
    } else if (imagePath === null) {
      imagePath = arg;
    } else {
      throw new Error(`unexpected argument: ${arg}\n${USAGE}`);
    }
  }

  if (imagePath === null) return null;
  if (textFile !== null && !existsSync(textFile)) {
    throw new Error(`text file not found: ${textFile}`);
  }
  return { imagePath, compress, textFile, confidence };
}

async function main(): Promise<void> {
  let options: Options | null;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`✖ ${(error as Error).message}`);
    process.exitCode = 1;
    return;
  }
  if (options === null) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }

  loadBackendEnv();

  const { path, bytes } = requireReadableImage(options.imagePath);
  const sidecar = sidecarTextPath(path);
  const textPath = options.textFile ?? (existsSync(sidecar) ? sidecar : null);
  assertFixtureTextSource(textPath !== null);

  // Resolve credentials before the decode/encode work so a missing file
  // fails in milliseconds instead of after processing an image.
  const vision = textPath === null ? createVisionClient(resolveVisionCredentials()) : null;

  const prepared = await prepareFixtureImage(bytes, { compress: options.compress });
  const fixture =
    textPath !== null
      ? {
          text: readFixtureText(textPath),
          confidence: options.confidence ?? SIDECAR_TEXT_CONFIDENCE,
        }
      : await recognizeWithVision(vision!, prepared.bytes);

  upsertFixture(prepared.sha256, fixture);

  console.log(`  ${describePreparation(prepared)}, ${prepared.bytes.length} bytes`);
  console.log(
    `Wrote fixture for ${basename(path)}, sha256=${prepared.sha256.slice(0, 8)}..., ` +
      `text length=${fixture.text.length}`,
  );
  console.log('  Restart the dev server so MockProvider reloads mock-fixtures.json.');
}

main().catch((error: unknown) => {
  console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
