-- ============================================================
-- Yene Verify — merchant verification accounts
--
-- Adapters such as Abyssinia need an account identifier that is not
-- printed on the receipt (last 5 digits). Store the per-bank settings
-- on the merchant so the verification pipeline can inject them into
-- VerifyInput.supplementary.
--
-- Shape (all fields optional):
--   {
--     "cbe":       { "last8": "12345678" },
--     "abyssinia": { "last5": "12345" },
--     "awash":     { "accountNumber": "0123456789" }
--   }
-- ============================================================

ALTER TABLE "merchants"
  ADD COLUMN "verification_accounts" JSONB NOT NULL DEFAULT '{}';
