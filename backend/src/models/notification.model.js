const { query } = require('../config/database');

const NotificationModel = {
  async create(data) {
    const { rows } = await query(
      `INSERT INTO notifications (id, type, owner_id, sender_id, channels, status, payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
       RETURNING *`,
      [
        data.id, data.type, data.owner_id || null, data.sender_id || null,
        data.channels || [], data.status || 'queued',
        JSON.stringify(data.payload || {}),
      ]
    );
    return rows[0];
  },

  async findById(id) {
    const { rows } = await query(`SELECT * FROM notifications WHERE id = $1`, [id]);
    return rows[0] || null;
  },

  async findByOwnerId(ownerId) {
    const { rows } = await query(
      `SELECT * FROM notifications WHERE owner_id = $1 ORDER BY created_at DESC`,
      [ownerId]
    );
    return rows;
  },

  async findBySenderId(senderId) {
    const { rows } = await query(
      `SELECT * FROM notifications WHERE sender_id = $1 ORDER BY created_at DESC`,
      [senderId]
    );
    return rows;
  },

  async updateStatus(id, status) {
    const { rows } = await query(
      `UPDATE notifications SET status = $2 WHERE id = $1 RETURNING *`,
      [id, status]
    );
    return rows[0] || null;
  },
};

module.exports = NotificationModel;
