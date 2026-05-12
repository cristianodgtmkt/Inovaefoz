-- WhatsApp OTP authentication for admin panel
-- Replaces email/password with phone-based passwordless login

-- OTP table (one active OTP per phone)
CREATE TABLE IF NOT EXISTS wa_auth_otp (
  telefone TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  consumed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wa_auth_otp_expires_idx ON wa_auth_otp (expires_at);

-- Add telefone + nome to tenant_users (for WhatsApp login lookup)
ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS telefone TEXT;
ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS nome TEXT;
ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';  -- active | pending | blocked
CREATE UNIQUE INDEX IF NOT EXISTS tenant_users_telefone_uniq ON tenant_users (telefone) WHERE telefone IS NOT NULL;

-- Pending signups (new phones requesting access)
CREATE TABLE IF NOT EXISTS wa_auth_signup_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone TEXT NOT NULL,
  nome TEXT NOT NULL,
  loja_solicitada TEXT,
  tenant_id UUID REFERENCES tenants(id),
  status TEXT NOT NULL DEFAULT 'pending',   -- pending | approved | rejected
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wa_signup_status_idx ON wa_auth_signup_requests (status, created_at DESC);

-- Backfill: associate existing admin user (cristiano) with a phone
-- (will run after user manually sets WA_ADMIN_PHONE env var on next /api/auth/wa/request)
