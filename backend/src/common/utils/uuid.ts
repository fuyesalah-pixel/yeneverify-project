import { randomBytes } from 'node:crypto';

// ============================================================
// Yene Verify — UUID v7 generator
//
// UUID v7 is time-sortable, globally unique, and safe to expose in URLs.
// Application code calls newId() for every Prisma create. The database has
// a uuid_generate_v4() fallback for administrative/import paths only.
//
// Layout (RFC 9562 §5.7):
//   48-bit Unix millisecond timestamp | ver=7 | 12 random bits
//   | variant=10 | 62 random bits
//
// See docs/architecture/05-database.md §1.
// ============================================================

const UUID_V7_VERSION = 7;

/** Generate a UUID v7 string suitable for a PostgreSQL uuid column. */
export function newId(): string {
  const timestamp = BigInt(Date.now());
  const bytes = Buffer.alloc(16);

  // Bytes 0–5: 48-bit big-endian Unix timestamp in milliseconds.
  bytes[0] = Number((timestamp >> 40n) & 0xffn);
  bytes[1] = Number((timestamp >> 32n) & 0xffn);
  bytes[2] = Number((timestamp >> 24n) & 0xffn);
  bytes[3] = Number((timestamp >> 16n) & 0xffn);
  bytes[4] = Number((timestamp >> 8n) & 0xffn);
  bytes[5] = Number(timestamp & 0xffn);

  // Bytes 6–15: version, variant, and cryptographically random bits.
  const random = randomBytes(10);
  bytes[6] = 0x70 | (random[0] & 0x0f);
  bytes[7] = random[1];
  bytes[8] = 0x80 | (random[2] & 0x3f);
  bytes[9] = random[3];
  random.copy(bytes, 10, 4, 10);

  const hex = (start: number, end: number) => bytes.subarray(start, end).toString('hex');
  return [hex(0, 4), hex(4, 6), hex(6, 8), hex(8, 10), hex(10, 16)].join('-');
}

/** Validate the canonical UUID text form (any RFC 4122/9562 version). */
export function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/** Extract the creation time from a UUID v7, or null for another version. */
export function uuidToDate(uuid: string): Date | null {
  if (!isValidUuid(uuid)) return null;

  const hex = uuid.replace(/-/g, '');
  const version = parseInt(hex[12], 16);
  if (version !== UUID_V7_VERSION) return null;

  const timestamp = parseInt(hex.substring(0, 12), 16);
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date;
}
