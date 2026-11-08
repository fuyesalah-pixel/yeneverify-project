-- v1.9.1 â€” Google Sign-In linking fields on users
--
-- Phone remains the primary identity. Google is a linked login method only;
-- no signup with Google alone. Columns are nullable so existing users can
-- adopt linking incrementally.

ALTER TABLE "users" ADD COLUMN "google_uid" TEXT UNIQUE;
ALTER TABLE "users" ADD COLUMN "google_email" TEXT;
ALTER TABLE "users" ADD COLUMN "google_linked_at" TIMESTAMPTZ(6);
