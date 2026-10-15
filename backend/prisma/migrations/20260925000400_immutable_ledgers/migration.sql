-- Yene Verify — immutable ledgers
-- These rules are defense in depth for the append-only credit and audit
-- tables. Application code must never issue UPDATE/DELETE against them.

DROP RULE IF EXISTS "credit_tx_no_update" ON "credit_transactions";
CREATE RULE "credit_tx_no_update" AS
  ON UPDATE TO "credit_transactions" DO INSTEAD NOTHING;

DROP RULE IF EXISTS "credit_tx_no_delete" ON "credit_transactions";
CREATE RULE "credit_tx_no_delete" AS
  ON DELETE TO "credit_transactions" DO INSTEAD NOTHING;

DROP RULE IF EXISTS "audit_logs_no_update" ON "audit_logs";
CREATE RULE "audit_logs_no_update" AS
  ON UPDATE TO "audit_logs" DO INSTEAD NOTHING;

DROP RULE IF EXISTS "audit_logs_no_delete" ON "audit_logs";
CREATE RULE "audit_logs_no_delete" AS
  ON DELETE TO "audit_logs" DO INSTEAD NOTHING;

-- Runtime roles receive no mutation privilege on these tables even if a
-- future GRANT is added by an operator.
REVOKE UPDATE, DELETE ON "credit_transactions" FROM yene_app, yene_readonly;
REVOKE UPDATE, DELETE ON "audit_logs" FROM yene_app, yene_readonly;

-- bank_reference_lookups is a replaceable global cache, not an accounting
-- ledger. Its unique key is replaced with a new row by the verification
-- worker and expired rows are purged by the retention job.
