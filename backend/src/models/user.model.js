const { query } = require('../config/database');

const WRITABLE = ['name', 'email', 'password_hash', 'role', 'phone', 'avatar_url', 'is_verified', 'google_id', 'provider'];

const UserModel = {
  async findAll() {
    const { rows } = await query(`SELECT * FROM users ORDER BY created_at DESC`);
    return rows.map(omitPassword);
  },

  async findById(id) {
    const { rows } = await query(`SELECT * FROM users WHERE id = $1`, [id]);
    return rows[0] ? omitPassword(rows[0]) : null;
  },

  async findByIdWithPassword(id) {
    const { rows } = await query(`SELECT * FROM users WHERE id = $1`, [id]);
    return rows[0] || null;
  },

  async findByEmail(email) {
    if (!email) return null;
    const { rows } = await query(`SELECT * FROM users WHERE email = $1`, [email.toLowerCase()]);
    return rows[0] || null;
  },

  async findByPhone(phone) {
    if (!phone) return null;
    const normalized = String(phone).replace(/\s+/g, '');
    const { rows } = await query(
      `SELECT * FROM users WHERE regexp_replace(COALESCE(phone,''), '\\s+', '', 'g') = $1`,
      [normalized]
    );
    return rows[0] || null;
  },

  async findByGoogleId(googleId) {
    if (!googleId) return null;
    const { rows } = await query(`SELECT * FROM users WHERE google_id = $1`, [googleId]);
    return rows[0] || null;
  },

  async create(data) {
    const { rows } = await query(
      `INSERT INTO users
         (id, name, email, password_hash, role, phone, avatar_url, is_verified, google_id, provider)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        data.id,
        data.name,
        data.email ? data.email.toLowerCase() : null,
        data.password_hash || null,
        data.role || 'buyer',
        data.phone || null,
        data.avatar_url || null,
        data.is_verified || false,
        data.google_id || null,
        data.provider || 'local',
      ]
    );
    return omitPassword(rows[0]);
  },

  async update(id, partial) {
    const sets = [];
    const params = [id];
    for (const key of WRITABLE) {
      if (key in partial) {
        params.push(key === 'email' && partial[key] ? partial[key].toLowerCase() : partial[key]);
        sets.push(`${key} = $${params.length}`);
      }
    }
    if (sets.length === 0) return UserModel.findById(id);
    sets.push('updated_at = NOW()');
    const { rows } = await query(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );
    return rows[0] ? omitPassword(rows[0]) : null;
  },

  async delete(id) {
    const { rowCount } = await query(`DELETE FROM users WHERE id = $1`, [id]);
    return rowCount > 0;
  },
};

function omitPassword(user) {
  if (!user) return null;
  const { password_hash, ...safe } = user;
  return safe;
}

module.exports = UserModel;
