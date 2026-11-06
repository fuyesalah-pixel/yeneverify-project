// ============================================================
// Yene Verify — OCR Provider Interface
//
// Receipt images are turned into raw text by a pluggable OCR
// engine. Three providers exist today:
//
//   mock           — deterministic dev engine (fixtures by sha256)
//   tesseract      — local engine (tesseract.js); no credentials
//   google-vision  — Google Cloud Vision textDetection
//
// Providers never persist anything; the OCR layer only returns
// text. Storage of results into `verifications` happens later
// (Step 13E). Provider selection is configured with OCR_PROVIDER.
// ============================================================

export type OcrProviderName = 'mock' | 'tesseract' | 'google-vision';

export interface OcrResult {
  text: string;
  /** Provider confidence in 0..1; 0 means "not available". */
  confidence: number;
  provider: OcrProviderName;
  durationMs: number;
  /** Provider-specific payload, capped so responses never balloon. */
  raw?: unknown;
}

export interface OcrProvider {
  readonly name: OcrProviderName;

  /** Run text extraction on an image and return the raw text. */
  recognize(imageBuffer: Buffer, mimeType: string): Promise<OcrResult>;

  /** Cheap readiness probe used by health surfaces. */
  health(): Promise<boolean>;
}

/** Provider-specific payloads must never exceed this serialized size. */
export const MAX_OCR_RAW_BYTES = 5 * 1024;

/** Serialize a provider payload and cap it at MAX_OCR_RAW_BYTES. */
export function capRawPayload(value: unknown): unknown {
  const serialized = JSON.stringify(value) ?? '';
  if (serialized.length <= MAX_OCR_RAW_BYTES) {
    return value;
  }
  return { truncated: serialized.slice(0, MAX_OCR_RAW_BYTES) };
}
