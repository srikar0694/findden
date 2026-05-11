/**
 * Transaction model — Postgres backed.
 * Polymorphic: each row carries either subscription_id or property_id (XOR).
 */

const db = require('../config/database');

const TransactionModel = {
  async findById(id) {
    const { rows } = await db.query(
      `SELECT * FROM transactions WHERE id = $1`, [id]
    );
    return rows[0] || null;
  },

  /**
   * Paginated history for a user. Returns { rows, total }.
   * Uses the (user_id, created_at DESC) index.
   */
  async findByUserId(userId, limit = 10, offset = 0) {
    const [data, count] = await Promise.all([
      db.query(
        `SELECT * FROM transactions
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      ),
      db.query(
        `SELECT COUNT(*)::int AS total FROM transactions WHERE user_id = $1`,
        [userId]
      ),
    ]);
    return { rows: data.rows, total: count.rows[0].total };
  },

  /** Idempotent gateway lookup — uses the unique partial index. */
  async findByPaymentRef(ref) {
    const { rows } = await db.query(
      `SELECT * FROM transactions WHERE payment_ref = $1 LIMIT 1`, [ref]
    );
    return rows[0] || null;
  },

  async create({
    id, user_id, subscription_id = null, property_id = null,
    amount, currency = 'INR', status = 'pending',
    payment_gateway = null, payment_ref = null, metadata = {},
  }) {
    const { rows } = await db.query(
      `INSERT INTO transactions
         (id, user_id, subscription_id, property_id,
          amount, currency, status, payment_gateway, payment_ref, metadata)
       VALUES (COALESCE($1, uuid_generate_v4()), $2, $3, $4,
               $5, $6, $7, $8, $9, $10::jsonb)
       RETURNING *`,
      [id || null, user_id, subscription_id, property_id,
       amount, currency, status, payment_gateway, payment_ref, metadata]
    );
    return rows[0];
  },

  async update(id, partial) {
    const allowed = ['status', 'payment_ref', 'payment_gateway', 'metadata'];
    const sets = [];
    const params = [id];
    for (const key of allowed) {
      if (key in partial) {
        params.push(partial[key]);
        sets.push(`${key} = $${params.length}`);
      }
    }
    if (sets.length === 0) return TransactionModel.findById(id);
    const { rows } = await db.query(
      `UPDATE transactions SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );
    return rows[0] || null;
  },

  /** Total successful spend by a user. */
  async sumByUserId(userId) {
    const { rows } = await db.query(
      `SELECT COALESCE(SUM(amount), 0)::numeric AS total
       FROM transactions
       WHERE user_id = $1 AND status = 'success'`,
      [userId]
    );
    return Number(rows[0].total);
  },
};

module.exports = TransactionModel;
