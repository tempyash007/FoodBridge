-- ============================================================================
-- Migration: Create password_reset_tokens table
-- Run this manually:  psql -d food_bridge -f migrations/create_password_reset_tokens.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    token_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(user_id),
    email       VARCHAR NOT NULL,
    token_hash  VARCHAR NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    used        BOOLEAN DEFAULT false,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by email + unused tokens
CREATE INDEX IF NOT EXISTS idx_prt_email_unused
    ON password_reset_tokens (email)
    WHERE used = false;
