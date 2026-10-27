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

// ── BigInt JSON serialization (jest + worker IPC fix) ──────────────
// The credit ledger is bigint-native. Jest's worker transport chokes on
// BigInt when mock records or assertions cross the worker boundary
// ("Do not know how to serialize a BigInt"). Wiring toJSON lets the
// test harness serialize balances as strings; production code keeps
// converting bigint → string explicitly at the API boundary.
// eslint-disable-next-line no-extend-native
BigInt.prototype.toJSON = function () {
  return this.toString();
};
