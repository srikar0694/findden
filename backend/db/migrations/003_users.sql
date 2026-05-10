-- 003_users.sql
-- Account holders. Email is the natural login key (UNIQUE).

CREATE TABLE IF NOT EXISTS users (
  id            UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT         NOT NULL,
  role          user_role    NOT NULL DEFAULT 'buyer',
  phone         VARCHAR(20),
  avatar_url    TEXT,
  is_verified   BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Email already has a UNIQUE constraint (which builds a b-tree).
-- A separate idx_users_email would be redundant; do not add it.
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
