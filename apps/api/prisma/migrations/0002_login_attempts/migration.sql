-- ============================================================================
-- 0002_login_attempts — Auth hardening (PLAN/13 §3)
--
-- The login attempt tracking table used by auth-service.ts but missing from the
-- initial migration. Without it, every login attempt crashes with P2021.
-- ============================================================================

CREATE TABLE login_attempts (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username      text    NOT NULL,
  ip_address    varchar(45),
  succeeded     boolean NOT NULL DEFAULT false,
  failure_reason varchar(64),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_login_attempts_username_created ON login_attempts(username, created_at);
