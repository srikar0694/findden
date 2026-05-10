-- 007_transactions.sql
-- Payment ledger. Polymorphic via subscription_id XOR property_id —
-- exactly one must be non-null. Keeps both billing types in one ledger
-- so "give me all my payments" is a single, unindexed-join query.

CREATE TABLE IF NOT EXISTS transactions (
  id              UUID               PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID               NOT NULL REFERENCES users(id),
  subscription_id UUID               REFERENCES subscriptions(id),
  property_id     UUID               REFERENCES properties(id),
  amount          NUMERIC(10,2)      NOT NULL CHECK (amount >= 0),
  currency        CHAR(3)            NOT NULL DEFAULT 'INR',
  status          transaction_status NOT NULL DEFAULT 'pending',
  payment_gateway VARCHAR(50),
  payment_ref     VARCHAR(255),
  metadata        JSONB              NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ        NOT NULL DEFAULT NOW(),

  -- XOR: exactly one of subscription_id / property_id is set.
  CONSTRAINT chk_txn_xor CHECK (
    (subscription_id IS NOT NULL)::int + (property_id IS NOT NULL)::int = 1
  )
);

-- Payment-history list: user_id + created_at DESC is the canonical query.
CREATE INDEX IF NOT EXISTS idx_transactions_user_created
  ON transactions (user_id, created_at DESC);

-- Idempotency: gateway callbacks look up by payment_ref. Partial index
-- skips rows that haven't been confirmed yet.
CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_payment_ref
  ON transactions (payment_ref)
  WHERE payment_ref IS NOT NULL;

-- Status filtering for finance dashboards.
CREATE INDEX IF NOT EXISTS idx_transactions_status
  ON transactions (status);
