const { query } = require('../config/database');

const MessageModel = {
  async findAll() {
    const { rows } = await query(`SELECT * FROM messages ORDER BY created_at DESC`);
    return rows;
  },

  async findById(id) {
    const { rows } = await query(`SELECT * FROM messages WHERE id = $1`, [id]);
    return rows[0] || null;
  },

  async findBySenderId(userId) {
    const { rows } = await query(
      `SELECT * FROM messages WHERE sender_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    return rows;
  },

  async findByPropertyId(propertyId) {
    const { rows } = await query(
      `SELECT * FROM messages WHERE property_id = $1 ORDER BY created_at DESC`,
      [propertyId]
    );
    return rows;
  },

  async countSentInWindow(userId, sinceIsoDate) {
    const { rows } = await query(
      `SELECT COUNT(*)::int AS n FROM messages WHERE sender_id = $1 AND created_at >= $2`,
      [userId, sinceIsoDate]
    );
    return rows[0].n;
  },

  async contactedPropertyIds(userId) {
    const { rows } = await query(
      `SELECT DISTINCT property_id FROM messages WHERE sender_id = $1`,
      [userId]
    );
    return rows.map((r) => r.property_id);
  },

  async contactedSummary(userId) {
    const { rows } = await query(
      `SELECT property_id, MAX(created_at) AS last_contacted_at
       FROM messages
       WHERE sender_id = $1
       GROUP BY property_id
       ORDER BY last_contacted_at DESC`,
      [userId]
    );
    return rows.map((r) => ({ propertyId: r.property_id, lastContactedAt: r.last_contacted_at }));
  },

  async create(data) {
    const { rows } = await query(
      `INSERT INTO messages
         (id, sender_id, recipient_id, property_id, sender_name, sender_phone, sender_email, body, read)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        data.id, data.sender_id, data.recipient_id, data.property_id,
        data.sender_name || null, data.sender_phone || null, data.sender_email || null,
        data.body, data.read ?? false,
      ]
    );
    return rows[0];
  },
};

module.exports = MessageModel;
