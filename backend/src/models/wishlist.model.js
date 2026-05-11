const { query } = require('../config/database');

const WishlistModel = {
  async findByUserId(userId) {
    const { rows } = await query(
      `SELECT * FROM wishlists WHERE user_id = $1 ORDER BY added_at DESC`,
      [userId]
    );
    return rows;
  },

  async findByUserAndProperty(userId, propertyId) {
    const { rows } = await query(
      `SELECT * FROM wishlists WHERE user_id = $1 AND property_id = $2`,
      [userId, propertyId]
    );
    return rows[0] || null;
  },

  async countByUser(userId) {
    const { rows } = await query(
      `SELECT COUNT(*)::int AS n FROM wishlists WHERE user_id = $1`,
      [userId]
    );
    return rows[0].n;
  },

  /** Idempotent — returns existing row if already wishlisted. */
  async add({ id, user_id, property_id, notes = null }) {
    const { rows } = await query(
      `INSERT INTO wishlists (id, user_id, property_id, notes)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, property_id) DO UPDATE
         SET added_at = wishlists.added_at
       RETURNING *`,
      [id, user_id, property_id, notes]
    );
    return rows[0];
  },

  async remove(userId, propertyId) {
    const { rowCount } = await query(
      `DELETE FROM wishlists WHERE user_id = $1 AND property_id = $2`,
      [userId, propertyId]
    );
    return rowCount;
  },

  async removeById(id) {
    const { rowCount } = await query(`DELETE FROM wishlists WHERE id = $1`, [id]);
    return rowCount > 0;
  },
};

module.exports = WishlistModel;
