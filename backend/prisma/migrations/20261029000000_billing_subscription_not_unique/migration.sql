-- ============================================================
-- Yene Verify — billing_verifications.subscription_id is NOT unique
--
-- A renewed (extended) subscription is the target of SEVERAL approved
-- billing rows: approving the second same-package payment links the
-- SAME subscription id again, which violated the 1:1 unique key
-- (`billing_verifications_subscription_id_key`, U-2350) and downgraded
-- every renewal to NEEDS_REVIEW. One subscription ← many billings is
-- the real cardinality (Subscription.billingVerifs was already a list).
-- ============================================================

-- Prisma models unique keys as UNIQUE INDEXES, not table constraints —
-- DROP CONSTRAINT IF EXISTS would silently no-op here.
DROP INDEX IF EXISTS "billing_verifications_subscription_id_key";

CREATE INDEX IF NOT EXISTS "billing_verifications_subscription_id_idx"
  ON "billing_verifications"("subscription_id");
