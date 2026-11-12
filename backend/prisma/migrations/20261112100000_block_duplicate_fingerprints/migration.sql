-- Admin blocklist for cross-merchant duplicate receipts.

ALTER TABLE "duplicate_fingerprints"
  ADD COLUMN "blocked_at" TIMESTAMPTZ(6),
  ADD COLUMN "blocked_by_user_id" UUID;

CREATE INDEX "duplicate_fingerprints_blocked_at_idx"
  ON "duplicate_fingerprints" ("blocked_at");
