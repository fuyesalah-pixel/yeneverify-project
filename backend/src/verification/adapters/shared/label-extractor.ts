// ============================================================
// Yene Verify — Label-Anchored Value Extraction
//
// Real receipts print the transaction reference next to a label
// ("Transaction Reference: FT26201XP8NP"). Parsing the label is
// more reliable than guessing per-bank formats, so every adapter
// tries this first and only falls back to its shape regex when
// the receipt has no matching label.
// ============================================================

export interface ExtractOptions {
  /** Labels in priority order, matched case-insensitively by default. */
  labels: string[];
  /** Optional shape check applied to the captured value. */
  validator?: RegExp;
  /** Guards against OCR runs that swallowed the rest of the line. Default 30. */
  maxLength?: number;
  /** Default false. */
  caseSensitive?: boolean;
}

const DEFAULT_MAX_LENGTH = 30;
const TRAILING_PUNCTUATION = /[:,.]+$/;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Extracts the value printed after one of `labels` in OCR text.
 *
 * Handles `Label: VALUE`, `Label — VALUE`, `Label\nVALUE` and plain
 * `Label VALUE`. The value runs to the next whitespace; trailing
 * `: , .` are trimmed. Returns the first label's valid value, or
 * null when no label matches (or every match fails validation).
 */
export function extractLabeledValue(rawOcrText: string, options: ExtractOptions): string | null {
  if (!rawOcrText || rawOcrText.trim().length === 0) {
    return null;
  }

  const maxLength = options.maxLength ?? DEFAULT_MAX_LENGTH;
  const text = rawOcrText.replace(/\s+/g, ' ').trim();
  const flags = options.caseSensitive ? '' : 'i';

  for (const label of options.labels) {
    if (!label) continue;

    // Word boundaries keep "Ref" from matching inside "Reference" and
    // stop labels from latching onto the tail of unrelated words.
    const pattern = new RegExp(`\\b${escapeRegExp(label)}\\b\\s*(?::|—|–|-)?\\s*([^\\s]+)`, flags);
    const match = pattern.exec(text);
    if (!match) continue;

    const value = match[1].replace(TRAILING_PUNCTUATION, '');
    if (value.length === 0 || value.length > maxLength) continue;
    if (options.validator && !options.validator.test(value)) continue;

    return value;
  }

  return null;
}
