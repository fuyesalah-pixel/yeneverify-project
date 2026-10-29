-- ============================================================
-- Yene Verify — Billing initiation precedes screenshot upload
--
-- POST /billing/initiate creates the PENDING BillingVerification
-- session (the anchor for the upload flow) BEFORE the merchant has
-- uploaded any receipt, so billing_verifications.receipt_id must be
-- nullable. The column is filled in by POST /billing/submit.
-- ============================================================

ALTER TABLE "billing_verifications" ALTER COLUMN "receipt_id" DROP NOT NULL;
