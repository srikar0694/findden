-- 05_transactions.seed.sql
-- Payment ledger entries from seed data.
-- Uses matching UUIDs from other seed files.

INSERT INTO transactions (id, user_id, subscription_id, property_id, amount, currency, status, payment_gateway, payment_ref, metadata, created_at, updated_at)
VALUES
  ('44444444-4444-4444-8444-000000000001'::uuid,
   '11111111-1111-4111-8111-000000000002'::uuid,
   '22222222-2222-4222-8222-000000000001'::uuid,
   NULL,
   2999.00,
   'INR',
   'success'::transaction_status,
   'razorpay',
   'rzp_pay_demo001',
   '{}'::jsonb,
   '2026-03-01T00:00:00.000Z'::timestamptz,
   '2026-03-01T00:00:00.000Z'::timestamptz),
  ('44444444-4444-4444-8444-000000000002'::uuid,
   '11111111-1111-4111-8111-000000000004'::uuid,
   '22222222-2222-4222-8222-000000000002'::uuid,
   NULL,
   999.00,
   'INR',
   'success'::transaction_status,
   'razorpay',
   'rzp_pay_demo002',
   '{}'::jsonb,
   '2026-03-15T00:00:00.000Z'::timestamptz,
   '2026-03-15T00:00:00.000Z'::timestamptz)
ON CONFLICT (id) DO UPDATE SET
  user_id       = EXCLUDED.user_id,
  subscription_id = EXCLUDED.subscription_id,
  property_id   = EXCLUDED.property_id,
  amount        = EXCLUDED.amount,
  status        = EXCLUDED.status,
  payment_ref   = EXCLUDED.payment_ref,
  metadata      = EXCLUDED.metadata,
  updated_at    = EXCLUDED.updated_at;
