// ============================================================
// Yene Verify — Client OCR Hint (v1.8.5)
//
// The mobile app runs ML Kit on-device and sends the recognized text
// with the submit. It is untrusted input: the pipeline may use it to
// skip the server-side OCR round-trip, but detection, reference
// extraction and the final verdict still run on the server.
//
// Only text above [CLIENT_OCR_MIN_CONFIDENCE] is preferred; anything
// lower falls back to the configured server OCR (Vision, else
// Tesseract).
// ============================================================

export const CLIENT_OCR_MIN_CONFIDENCE = 0.6;

export type ClientOcrHint = {
  text: string;
  confidence: number;
};

/**
 * Returns the usable client hint, or null when the client OCR is
 * missing, empty, or below the confidence floor.
 */
export function usableClientOcr(text: unknown, confidence: unknown): ClientOcrHint | null {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (trimmed.length === 0) return null;
  if (typeof confidence !== 'number' || !Number.isFinite(confidence)) return null;
  if (confidence <= CLIENT_OCR_MIN_CONFIDENCE) return null;
  return { text: trimmed, confidence };
}
