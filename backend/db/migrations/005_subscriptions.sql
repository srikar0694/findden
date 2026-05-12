-- 005_subscriptions.sql
-- A user's active membership of a plan. Quota deduction happens here.
--
-- plan_id is TEXT (matches plans.id). expires_at is NULLABLE so that
-- one_time plans can grant credits that never expire — those rows have
-- expires_at IS NULL and are filtered with `(expires_at IS NULL OR expires_at > NOW())`.

CREATE TABLE IF NOT EXISTS subscriptions (
  id          UUID                PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID                NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id     TEXT                NOT NULL REFERENCES plans(id),
  quota_used  INT                 NOT NULL DEFAULT 0,
  starts_at   TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ,
  status      subscription_status NOT NULL DEFAULT 'active',
  created_at  TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_subs_quota_nonneg CHECK (quota_used >= 0),
  CONSTRAINT chk_subs_dates        CHECK (expires_at IS NULL OR expires_at > starts_at)
);

-- Lookups by user (dashboard, "find my active subscription").
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);

-- Cron jobs: "expire all rows with expires_at <= NOW() and status = active".
-- Partial index keeps the scan tiny even at millions of historical subscriptions.
-- Skips one_time plans (expires_at IS NULL) which never lapse.
CREATE INDEX IF NOT EXISTS idx_subscriptions_active_expiry
  ON subscriptions(expires_at)
  WHERE status = 'active' AND expires_at IS NOT NULL;
