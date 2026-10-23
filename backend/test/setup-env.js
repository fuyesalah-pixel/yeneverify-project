// ============================================================
// Yene Verify — Jest Setup (runs before any test module loads)
//
// Some host shells export a junk PORT (e.g. 0) in their inherited
// environment. Zod rejects it at ConfigModule boot, and dotenv only
// FILLS missing variables, so the junk value would permanently shadow
// backend/.env. Deleting an invalid host PORT lets the project .env
// win — mirroring the guard in scripts/export-openapi.ts.
//
// Plain .js on purpose: eslint's `{src,test}/**/*.ts` glob scopes the
// "no process.env" rule to TypeScript business code, not this bootstrap.
// ============================================================

const PORT = process.env.PORT;
if (PORT !== undefined && Number(PORT) < 1) {
  delete process.env.PORT;
}
