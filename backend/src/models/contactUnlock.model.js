const { query } = require('../config/database');

const ContactUnlockModel = {
  async findById(id) {
    const { rows } = await query(`SELECT * FROM contact_unlocks WHERE id = $1`, [id]);
    return rows[0] || null;
  },

  async findByUserId(userId) {
    const { rows } = await query(
      `SELECT * FROM contact_unlocks WHERE user_id = $1 ORDER BY granted_at DESC`,
      [userId]
    );
    return rows;
  },

  async findByUserAndProperty(userId, propertyId) {
    const { rows } = await query(
      `SELECT * FROM contact_unlocks WHERE user_id = $1 AND property_id = $2`,
      [userId, propertyId]
    );
    return rows[0] || null;
  },

  async countByUser(userId) {
    const { rows } = await query(
      `SELECT COUNT(*)::int AS n FROM contact_unlocks WHERE user_id = $1`,
      [userId]
    );
    return rows[0].n;
  },

  /** Idempotent — returns existing row if already granted. */
  async grant(data) {
    const { rows } = await query(
      `INSERT INTO contact_unlocks
         (id, user_id, property_id, source, subscription_id, transaction_id, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id, property_id) DO UPDATE
         SET granted_at = contact_unlocks.granted_at
       RETURNING *`,
      [
        data.id, data.user_id, data.property_id, data.source,
        data.subscription_id || null, data.transaction_id || null,
        data.expires_at || null,
      ]
    );
    return rows[0];
  },

  async hasUnlock(userId, propertyId) {
    const { rows } = await query(
      `SELECT 1 FROM contact_unlocks
       WHERE user_id = $1 AND property_id = $2
         AND (expires_at IS NULL OR expires_at > NOW())`,
      [userId, propertyId]
    );
    return rows.length > 0;
  },
};

module.exports = ContactUnlockModel;
