/**
 * Subscription model — Postgres backed.
 *
 * `expires_at` may be NULL — that means the user holds credits from a
 * one_time plan that never lapse (Single Property unlock). All time-based
 * filters use `(expires_at IS NULL OR expires_at > NOW())`.
 *
 * The quota column on plans is `unlock_quota` (renamed from generic `quota`)
 * to make its purpose obvious in product copy and analytics.
 */

const db = require('../config/database');

const SubscriptionModel = {
  async findById(id) {
    const { rows } = await db.query(
      `SELECT * FROM subscriptions WHERE id = $1`, [id]
    );
    return rows[0] || null;
  },

  async findByUserId(userId) {
    const { rows } = await db.query(
      `SELECT * FROM subscriptions
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );
    return rows;
  },

  /**
   * Most recent active subscription that still has credits available.
   * One_time plans (expires_at IS NULL) qualify as long as quota remains.
   * NULLS LAST so timed plans rank ahead of perpetual one_time credits
   * when both exist (timed expires first, use it first).
   */
  async findActiveByUserId(userId) {
    const { rows } = await db.query(
      `SELECT * FROM subscriptions
       WHERE user_id = $1
         AND status = 'active'
         AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY expires_at NULLS LAST, created_at DESC
       LIMIT 1`,
      [userId]
    );
    return rows[0] || null;
  },

  async create({ id, user_id, plan_id, starts_at, expires_at }) {
    const { rows } = await db.query(
      `INSERT INTO subscriptions
         (id, user_id, plan_id, starts_at, expires_at)
       VALUES (COALESCE($1, uuid_generate_v4()), $2, $3, $4, $5)
       RETURNING *`,
      [id || null, user_id, plan_id, starts_at, expires_at]
    );
    return rows[0];
  },

  async update(id, partial) {
    const allowed = ['quota_used', 'status', 'expires_at'];
    const sets = [];
    const params = [id];
    for (const key of allowed) {
      if (key in partial) {
        params.push(partial[key]);
        sets.push(`${key} = $${params.length}`);
      }
    }
    if (sets.length === 0) return SubscriptionModel.findById(id);

    const { rows } = await db.query(
      `UPDATE subscriptions SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );
    return rows[0] || null;
  },

  /**
   * Atomic unlock — increments quota_used by 1 only if the subscription
   * is still active, not expired, and has quota remaining. Returns the
   * updated row or `null` if the deduction was rejected.
   *
   * Single UPDATE…RETURNING — no read-then-write race.
   */
  async deductQuota(subscriptionId) {
    const { rows } = await db.query(
      `UPDATE subscriptions s
       SET quota_used = s.quota_used + 1
       FROM plans p
       WHERE s.id = $1
         AND s.plan_id = p.id
         AND s.status = 'active'
         AND (s.expires_at IS NULL OR s.expires_at > NOW())
         AND s.quota_used < p.unlock_quota
       RETURNING s.id, s.quota_used, p.unlock_quota AS quota`,
      [subscriptionId]
    );
    return rows[0] || null;
  },

  /** Cron job — flips lapsed actives to `expired`. NULL expiries are skipped. */
  async expireStale() {
    const { rowCount } = await db.query(
      `UPDATE subscriptions
       SET status = 'expired'
       WHERE status = 'active'
         AND expires_at IS NOT NULL
         AND expires_at <= NOW()`
    );
    return rowCount;
  },
};

module.exports = SubscriptionModel;
