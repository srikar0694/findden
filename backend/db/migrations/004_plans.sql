-- 004_plans.sql
-- Contact-unlock pricing plans. Mirrors db/data/plans.json exactly.
--
-- ID is TEXT (not UUID) because plans are a small, hand-curated catalog
-- and the slug-style IDs (`plan-single-001`) are referenced from product
-- copy, payment-gateway metadata, and analytics dashboards. Using a
-- human-readable PK keeps those references legible.
--
-- duration_days is NULLABLE: one_time plans (e.g. Single Property) grant
-- credits that never expire. The matching subscription will store NULL
-- in expires_at — see migration 005.

CREATE TABLE IF NOT EXISTS plans (
  id             TEXT          PRIMARY KEY,
  name           VARCHAR(100)  NOT NULL,
  slug           VARCHAR(50)   NOT NULL UNIQUE,
  description    TEXT,
  tagline        TEXT,
  price          NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  currency       CHAR(3)       NOT NULL DEFAULT 'INR',
  unlock_quota   INT           NOT NULL CHECK (unlock_quota > 0),
  duration_days  INT           CHECK (duration_days IS NULL OR duration_days > 0),
  billing_cycle  VARCHAR(20)   NOT NULL
                  CHECK (billing_cycle IN ('one_time','monthly','yearly')),
  tier           VARCHAR(20)   NOT NULL
                  CHECK (tier IN ('single','bundle','pro','enterprise')),
  features       JSONB         NOT NULL DEFAULT '[]'::jsonb,
  highlight      BOOLEAN       NOT NULL DEFAULT FALSE,
  display_order  INT           NOT NULL DEFAULT 0,
  is_active      BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  -- A one_time plan must NOT have a duration; recurring plans MUST.
  CONSTRAINT chk_plans_duration_matches_cycle CHECK (
    (billing_cycle = 'one_time' AND duration_days IS NULL) OR
    (billing_cycle <> 'one_time' AND duration_days IS NOT NULL)
  )
);

-- Pricing page query: WHERE is_active ORDER BY display_order.
CREATE INDEX IF NOT EXISTS idx_plans_active_order
  ON plans (display_order)
  WHERE is_active = TRUE;
