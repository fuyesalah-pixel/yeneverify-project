-- ============================================================
-- credit_transactions verification-facing FKs: SET NULL → RESTRICT
--
-- BUG: the immutable-ledger migration (20260925000400) added
--   ON UPDATE/DELETE ... DO INSTEAD NOTHING rules on credit_transactions.
-- Any FK action targeting that table (SET NULL issues an UPDATE) gets
-- rewritten by the rule, so Postgres's referential-integrity check fails
-- with "gave unexpected result" — deleting even ONE verification row with
-- ZERO referencing credit rows aborts. Hard deletes of verifications
-- (test cleanup, future admin purge) were impossible.
--
-- FIX: RESTRICT makes the FK check a read-only SELECT on
-- credit_transactions, which the rules never intercept. Rows with
-- credit activity are correctly unpurgeable; all others delete cleanly.
-- ============================================================

ALTER TABLE "credit_transactions"
  DROP CONSTRAINT "credit_transactions_verification_id_fkey";

ALTER TABLE "credit_transactions"
  ADD CONSTRAINT "credit_transactions_verification_id_fkey"
  FOREIGN KEY ("verification_id") REFERENCES "verifications"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "credit_transactions"
  DROP CONSTRAINT "credit_transactions_billing_verification_id_fkey";

ALTER TABLE "credit_transactions"
  ADD CONSTRAINT "credit_transactions_billing_verification_id_fkey"
  FOREIGN KEY ("billing_verification_id") REFERENCES "billing_verifications"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
