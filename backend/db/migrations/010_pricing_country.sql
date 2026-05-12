-- 010_pricing_country.sql
-- (a) Adds the `country` column to properties (default 'India') so that the
--     post-property flow can capture the country selected (or auto-detected
--     from the map). Backfills existing rows to 'India'.
-- (b) Drops the NOT NULL on `pincode` (post-property no longer requires it).
-- (c) Updates the chk_plans_duration_matches_cycle constraint so that
--     monthly plans are allowed for any tier, then re-points the existing
--     plan rows to the new pricing:
--         single  → ₹9   / 1  unlock  / 30 days / monthly
--         cart    → ₹100 / 12 unlocks / 30 days / monthly
--         premium → ₹500 / 65 unlocks / 30 days / monthly

-- ─── Properties: country + relax pincode ────────────────────────────────────
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS country VARCHAR(80) NOT NULL DEFAULT 'India';

ALTER TABLE properties
  ALTER COLUMN pincode DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_properties_country ON properties (country);

-- ─── Plans: re-price to the three new tiers ─────────────────────────────────
-- The single-tier plan is now monthly (30-day expiry) so that subscriptions
-- correctly carry an `expires_at`. The constraint already permits this; we
-- simply update the rows.

UPDATE plans
SET name           = 'Starter',
    description    = 'Unlock 1 property in a month. Expires after 30 days.',
    tagline        = 'Try it out — pay as you go',
    price          = 9.00,
    unlock_quota   = 1,
    duration_days  = 30,
    billing_cycle  = 'monthly',
    tier           = 'single',
    features       = '["Unlock 1 property contact in a month","Expires after 30 days","No commitment, no auto-renew","Pay securely via Razorpay"]'::jsonb,
    highlight      = FALSE,
    display_order  = 1,
    is_active      = TRUE
WHERE slug = 'single';

UPDATE plans
SET name           = 'Multi-Property Pack',
    description    = 'Unlock up to 12 properties in a month. Expires after 30 days.',
    tagline        = 'For active buyers — better value',
    price          = 100.00,
    unlock_quota   = 12,
    duration_days  = 30,
    billing_cycle  = 'monthly',
    tier           = 'bundle',
    features       = '["Unlock up to 12 property contacts in a month","Expires after 30 days","Add from Wishlist or Search","Pay securely via Razorpay"]'::jsonb,
    highlight      = TRUE,
    display_order  = 2,
    is_active      = TRUE
WHERE slug = 'cart';

UPDATE plans
SET name           = 'Premium Monthly',
    description    = 'Unlock up to 65 properties in a month. Best value for serious buyers and agents.',
    tagline        = 'Best value — lowest per-unit price',
    price          = 500.00,
    unlock_quota   = 65,
    duration_days  = 30,
    billing_cycle  = 'monthly',
    tier           = 'pro',
    features       = '["Unlock up to 65 property contacts in a month","Expires after 30 days","Priority support","Pay securely via Razorpay"]'::jsonb,
    highlight      = FALSE,
    display_order  = 3,
    is_active      = TRUE
WHERE slug = 'premium';
