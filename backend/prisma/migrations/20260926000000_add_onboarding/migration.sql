-- ============================================================
-- Yene Verify -- Onboarding Migration
-- Adds sub_merchant_invites table, invite_status enum,
-- max_sub_merchants to packages, and onboarding-related fields.
-- ============================================================

-- Create invite_status enum
CREATE TYPE invite_status AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'REVOKED');

-- Create sub_merchant_invites table
CREATE TABLE sub_merchant_invites (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id         UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    invited_by_user_id  UUID NOT NULL REFERENCES users(id),
    invitee_phone       TEXT NOT NULL,
    invitee_name        TEXT,
    branch_label        TEXT,
    token_hash          TEXT NOT NULL UNIQUE,
    status              invite_status NOT NULL DEFAULT 'PENDING',
    expires_at          TIMESTAMPTZ(6) NOT NULL,
    consumed_at         TIMESTAMPTZ(6),
    consumed_by_user_id UUID REFERENCES users(id),
    resend_count        INT NOT NULL DEFAULT 0,
    last_sent_at        TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    sub_merchant_id     UUID REFERENCES sub_merchants(id),
    created_at          TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_sub_merchant_invites_merchant_id ON sub_merchant_invites(merchant_id);
CREATE INDEX idx_sub_merchant_invites_invitee_phone ON sub_merchant_invites(invitee_phone);
CREATE INDEX idx_sub_merchant_invites_status_expires ON sub_merchant_invites(status, expires_at);

-- Add max_sub_merchants to packages
ALTER TABLE packages ADD COLUMN IF NOT EXISTS max_sub_merchants INTEGER;

-- Update packages with max_sub_merchants values
UPDATE packages SET max_sub_merchants = 1 WHERE code = 'FREE';
UPDATE packages SET max_sub_merchants = 1 WHERE code = 'PREMIUM';
UPDATE packages SET max_sub_merchants = 10 WHERE code = 'BUSINESS';
UPDATE packages SET max_sub_merchants = NULL WHERE code = 'BUSINESS_PRO';
UPDATE packages SET max_sub_merchants = NULL WHERE code = 'API';

-- Trigger for updated_at on sub_merchant_invites
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_sub_merchant_invites_updated_at ON sub_merchant_invites;
CREATE TRIGGER update_sub_merchant_invites_updated_at
    BEFORE UPDATE ON sub_merchant_invites
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON sub_merchant_invites TO yene_app;
