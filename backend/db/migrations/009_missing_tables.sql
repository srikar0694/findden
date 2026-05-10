-- 009_missing_tables.sql
-- Add missing columns to existing tables and create tables that were
-- referenced in code but never had a migration.

-- ─── Users: Google OAuth support ─────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS google_id  TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS provider   VARCHAR(20) NOT NULL DEFAULT 'local';

-- ─── Properties: extra fields used by quick-post and admin flows ──────────────
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS sold_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified          BOOLEAN      NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS verified_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_by       UUID         REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_quick_post     BOOLEAN      NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS bhk               SMALLINT,
  ADD COLUMN IF NOT EXISTS contact_name      TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone     VARCHAR(20),
  ADD COLUMN IF NOT EXISTS contact_email     VARCHAR(255),
  ADD COLUMN IF NOT EXISTS possession_status VARCHAR(30)  NOT NULL DEFAULT 'ready_to_move',
  ADD COLUMN IF NOT EXISTS nearest_transit   TEXT[]       NOT NULL DEFAULT '{}';

-- ─── Messages ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id            UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id  UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_id   UUID         NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  sender_name   TEXT,
  sender_phone  VARCHAR(20),
  sender_email  VARCHAR(255),
  body          TEXT         NOT NULL,
  read          BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_sender   ON messages (sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_property ON messages (property_id);

-- ─── Notifications ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  type       VARCHAR(50)  NOT NULL,
  owner_id   UUID         REFERENCES users(id) ON DELETE SET NULL,
  sender_id  UUID         REFERENCES users(id) ON DELETE SET NULL,
  channels   TEXT[]       NOT NULL DEFAULT '{}',
  status     VARCHAR(20)  NOT NULL DEFAULT 'queued',
  payload    JSONB        NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_owner  ON notifications (owner_id,  created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_sender ON notifications (sender_id, created_at DESC);

-- ─── Wishlists ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wishlists (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        NOT NULL REFERENCES users(id)       ON DELETE CASCADE,
  property_id UUID        NOT NULL REFERENCES properties(id)  ON DELETE CASCADE,
  notes       TEXT,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, property_id)
);
CREATE INDEX IF NOT EXISTS idx_wishlists_user ON wishlists (user_id, added_at DESC);

-- ─── Contact Unlocks ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contact_unlocks (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID        NOT NULL REFERENCES users(id)          ON DELETE CASCADE,
  property_id     UUID        NOT NULL REFERENCES properties(id)     ON DELETE CASCADE,
  source          VARCHAR(30) NOT NULL,
  subscription_id UUID        REFERENCES subscriptions(id)           ON DELETE SET NULL,
  transaction_id  UUID        REFERENCES transactions(id)            ON DELETE SET NULL,
  granted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ,
  UNIQUE (user_id, property_id)
);
CREATE INDEX IF NOT EXISTS idx_contact_unlocks_user ON contact_unlocks (user_id);
