-- Supabase Migration: Higgsfield Lite
-- Complies with TECH_SPEC.md: demo_users, generation_jobs, credit_transactions, assets, RLS, idempotent refunds

-- 1. Demo Users
CREATE TABLE IF NOT EXISTS demo_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE DEFAULT 'demo_creator',
  credit_balance INTEGER NOT NULL DEFAULT 10 CHECK (credit_balance >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default demo user with 10 internal credits if not exists
INSERT INTO demo_users (id, username, credit_balance)
VALUES ('00000000-0000-0000-0000-000000000001', 'demo_creator', 10)
ON CONFLICT (id) DO NOTHING;

-- 2. Generation Jobs
CREATE TABLE IF NOT EXISTS generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_user_id UUID NOT NULL REFERENCES demo_users(id) ON DELETE CASCADE,
  idempotency_key TEXT UNIQUE NOT NULL,
  prompt TEXT NOT NULL,
  aspect_ratio TEXT NOT NULL DEFAULT '1:1',
  state TEXT NOT NULL CHECK (state IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  provider TEXT NOT NULL DEFAULT '@cf/black-forest-labs/flux-1-schnell',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  processing_lease_until TIMESTAMPTZ,
  safe_error_summary TEXT,
  retry_parent_id UUID REFERENCES generation_jobs(id) ON DELETE SET NULL,
  forced_failure BOOLEAN NOT NULL DEFAULT false,
  resulting_asset_id UUID
);

CREATE INDEX IF NOT EXISTS idx_generation_jobs_user_state ON generation_jobs(demo_user_id, state, created_at DESC);

-- 3. Credit Transactions Ledger
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES demo_users(id) ON DELETE CASCADE,
  job_id UUID REFERENCES generation_jobs(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('seed', 'reserve', 'refund')),
  amount INTEGER NOT NULL, -- e.g. -1 for reserve, +1 for refund, +10 for seed
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Idempotency constraint: cannot reserve or refund the same job more than once
  CONSTRAINT uq_job_transaction_type UNIQUE (job_id, transaction_type)
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user ON credit_transactions(user_id, created_at DESC);

-- Seed initial ledger entry if not present
INSERT INTO credit_transactions (user_id, transaction_type, amount, description)
SELECT '00000000-0000-0000-0000-000000000001', 'seed', 10, 'Initial seeded demo allowance'
WHERE NOT EXISTS (
  SELECT 1 FROM credit_transactions WHERE user_id = '00000000-0000-0000-0000-000000000001' AND transaction_type = 'seed'
);

-- 4. Assets Table
CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES generation_jobs(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES demo_users(id) ON DELETE CASCADE,
  storage_object_key TEXT NOT NULL,
  prompt TEXT NOT NULL,
  aspect_ratio TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  is_sample BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assets_user ON assets(user_id, created_at DESC);

-- Link resulting_asset_id foreign key back to assets
ALTER TABLE generation_jobs
  DROP CONSTRAINT IF EXISTS fk_resulting_asset;
ALTER TABLE generation_jobs
  ADD CONSTRAINT fk_resulting_asset FOREIGN KEY (resulting_asset_id) REFERENCES assets(id) ON DELETE SET NULL;

-- 5. Row Level Security (RLS)
-- Enforce strict server-only access.
-- The Next.js server uses the SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY
-- which bypasses RLS in Postgres. By enabling RLS without granting policies
-- to anon or authenticated, direct client/browser access is completely blocked (default deny).
ALTER TABLE demo_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

-- Clean up any prior public/anon policies
DROP POLICY IF EXISTS "Public read demo_users" ON demo_users;
DROP POLICY IF EXISTS "Public update demo_users" ON demo_users;
DROP POLICY IF EXISTS "Public read generation_jobs" ON generation_jobs;
DROP POLICY IF EXISTS "Public insert generation_jobs" ON generation_jobs;
DROP POLICY IF EXISTS "Public update generation_jobs" ON generation_jobs;
DROP POLICY IF EXISTS "Public read credit_transactions" ON credit_transactions;
DROP POLICY IF EXISTS "Public insert credit_transactions" ON credit_transactions;
DROP POLICY IF EXISTS "Public read assets" ON assets;
DROP POLICY IF EXISTS "Public insert assets" ON assets;
DROP POLICY IF EXISTS "Public delete assets" ON assets;

-- 6. Storage Bucket for Generated Images
-- Private bucket: only server via service role / signed URLs can access objects
INSERT INTO storage.buckets (id, name, public) VALUES ('generated-images', 'generated-images', false) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Allow select on generated-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow insert on generated-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow delete on generated-images" ON storage.objects;

