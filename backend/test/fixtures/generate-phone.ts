// ============================================================
// Yene Verify — Test fixture: valid Ethiopian phone numbers
//
// Per-run unique by construction. Format matches every DB
// constraint and DTO regex the app knows: +251 9 followed by
// 8 digits (Ethiopian mobile number, +251 country code).
// ============================================================

const RANDOM_DIGITS = 8;

/** Values already handed out this process — retry until a fresh one. */
const issued = new Set<string>();

/** `+2519XXXXXXXX` — unique per call within realistic test runs. */
export function generatePhone(): string {
  for (;;) {
    let digits = '';
    for (let i = 0; i < RANDOM_DIGITS; i++) {
      digits += Math.floor(Math.random() * 10).toString();
    }
    const phone = `+2519${digits}`;
    if (!issued.has(phone)) {
      issued.add(phone);
      return phone;
    }
  }
}
