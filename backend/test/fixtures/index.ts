// ============================================================
// Yene Verify — Shared test fixtures (backlog item 23)
//
// One import point for every e2e suite: per-run data that always
// satisfies the DB constraints the old hand-rolled beforeAlls
// kept tripping over (phone formats, FK chains, enum values).
// ============================================================

export { generatePhone } from './generate-phone';
export {
  createMerchantFixture,
  createDeviceSession,
  ensurePackage,
  type MerchantFixture,
  type MerchantFixtureInput,
} from './generate-merchant';
export {
  createSubMerchantFixture,
  type SubMerchantFixture,
  type SubMerchantFixtureInput,
} from './generate-sub-merchant';
export {
  createTransactionFixture,
  createManyTransactions,
  type TransactionFixture,
  type TransactionFixtureInput,
} from './generate-transaction';
export { resetFixtureState, type ResetScope } from './reset';
