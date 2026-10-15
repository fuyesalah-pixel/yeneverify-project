-- ============================================================
-- Yene Verify — PostgreSQL initialization
-- Runs once when the local Docker volume is first created.
-- Prisma migrations remain the source of truth for tables, RLS, and rules.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Set the tenant context for one transaction. The backend uses SET LOCAL via
-- the same function inside TenantGuard/PrismaService.
CREATE OR REPLACE FUNCTION set_tenant(p_merchant_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('app.current_merchant_id', p_merchant_id::TEXT, TRUE);
END;
$$;

CREATE OR REPLACE FUNCTION current_merchant_id()
RETURNS UUID
LANGUAGE SQL
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_merchant_id', TRUE), '')::UUID;
$$;

CREATE OR REPLACE FUNCTION current_user_id()
RETURNS UUID
LANGUAGE SQL
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID;
$$;

CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_role', TRUE), '');
$$;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT COALESCE(current_user_role() = 'ADMIN', FALSE);
$$;

DO $$
BEGIN
  RAISE NOTICE 'Yene Verify PostgreSQL initialization complete.';
  RAISE NOTICE 'Extensions: uuid-ossp, pgcrypto';
  RAISE NOTICE 'RLS helpers: set_tenant, current_merchant_id, current_user_id, current_user_role, is_admin';
END $$;
