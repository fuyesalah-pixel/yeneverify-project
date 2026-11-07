// ============================================================
// Yene Verify — CBE new-system receipt URLs
//
// CBE's newer receipts carry a QR code with a short URL:
//   https://mbreciept.cbe.com.et/{SHORT_ID}
// The short ID locates the transaction in CBE's JSON API. Kept as
// a pure module so both the QR hint resolver and the CBE client
// agree on what a valid new-system link looks like.
// ============================================================

export const CBE_NEW_RECEIPT_HOST = 'mbreciept.cbe.com.et';

/** Opaque locator. Bounded so it is safe to interpolate into an API path. */
const SHORT_ID_RE = /^[A-Za-z0-9_-]{6,64}$/;

/**
 * Returns the short ID from a CBE new-system receipt URL, or null
 * when the value is not such a URL. Only the path segment is
 * returned — query strings and fragments are ignored.
 */
export function extractCbeNewShortId(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.hostname.toLowerCase() !== CBE_NEW_RECEIPT_HOST) return null;

  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.length === 0) return null;

  let candidate: string;
  try {
    candidate = decodeURIComponent(segments[segments.length - 1]);
  } catch {
    return null;
  }
  return SHORT_ID_RE.test(candidate) ? candidate : null;
}
