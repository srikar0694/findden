-- 03_subscriptions.seed.sql
-- User plan subscriptions from seed data.
-- Uses matching UUIDs from 02_users.seed.sql and plan IDs from 01_plans.seed.sql

INSERT INTO subscriptions (id, user_id, plan_id, quota_used, starts_at, expires_at, status, created_at, updated_at)
VALUES
  (gen_random_uuid(),
   '11111111-1111-4111-8111-000000000002'::uuid,
   'plan-premium-003',
   7,
   '2026-03-01T00:00:00.000Z'::timestamptz,
   '2026-04-30T23:59:59.000Z'::timestamptz,
   'active'::subscription_status,
   '2026-03-01T00:00:00.000Z'::timestamptz,
   '2026-04-01T00:00:00.000Z'::timestamptz),
  (gen_random_uuid(),
   '11111111-1111-4111-8111-000000000004'::uuid,
   'plan-cart-002',
   4,
   '2026-03-15T00:00:00.000Z'::timestamptz,
   '2026-04-14T23:59:59.000Z'::timestamptz,
   'active'::subscription_status,
   '2026-03-15T00:00:00.000Z'::timestamptz,
   '2026-04-01T00:00:00.000Z'::timestamptz)
ON CONFLICT (id) DO UPDATE SET
  user_id      = EXCLUDED.user_id,
  plan_id      = EXCLUDED.plan_id,
  quota_used   = EXCLUDED.quota_used,
  starts_at    = EXCLUDED.starts_at,
  expires_at   = EXCLUDED.expires_at,
  status       = EXCLUDED.status,
  updated_at   = EXCLUDED.updated_at;
