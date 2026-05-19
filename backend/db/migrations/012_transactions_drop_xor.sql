-- 012_transactions_drop_xor.sql
--
-- The original `chk_txn_xor` constraint required exactly one of
-- subscription_id / property_id to be set on every row. That assumption
-- broke when we moved to a subscription-first flow:
--   • At INITIATE, neither id is known yet — the subscription doesn't exist,
--     and we no longer tie the transaction to a specific property.
--   • At VERIFY, the freshly-created subscription is patched in.
--
-- The "what did this payment pay for?" link is fully recoverable from
-- subscription_id (post-verify) and metadata.planSlug, so the XOR constraint
-- no longer earns its keep.

ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS chk_txn_xor;
