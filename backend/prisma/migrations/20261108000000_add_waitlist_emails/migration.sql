-- v1.9.0 â€” waitlist_emails table for public waitlist capture (mekatanker.shop)
--
-- Stores email + timestamp + source for the "Get notified when we launch"
-- form. Rate-limited at the application layer (5 per IP per hour).
-- Duplicate emails are handled idempotently by the service layer.

CREATE TABLE "waitlist_emails" (
  "id" UUID PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "source" TEXT,
  "ip" INET,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE INDEX "waitlist_emails_email_idx" ON "waitlist_emails"("email");
CREATE INDEX "waitlist_emails_created_at_idx" ON "waitlist_emails"("created_at" DESC);
