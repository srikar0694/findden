/**
 * Plan model — Postgres backed.
 *
 * Plans are tiny (< 100 rows) and rarely change. The pricing page hits
 * `findActive` on every render — consider an in-process cache (e.g. node-cache
 * with a 60s TTL) once traffic warrants it.
 *
 * IDs are TEXT (e.g. 'plan-single-001'), not UUIDs — see migration 004 for why.
 */

const db = require('../config/database');

// Columns the API is allowed to write. user-supplied keys are silently
// dropped if they're not in this list.
const WRITABLE = [
  'name', 'slug', 'description', 'tagline', 'price', 'currency',
  'unlock_quota', 'duration_days', 'billing_cycle', 'tier',
  'features', 'highlight', 'display_order', 'is_active',
];

const PlanModel = {
  async findAll() {
    const { rows } = await db.query(
      `SELECT * FROM plans ORDER BY display_order ASC, price ASC`
    );
    return rows;
  },

  /** Pricing-page query. Ordered by display_order so highlighted plans land where designers want them. */
  async findActive() {
    const { rows } = await db.query(
      `SELECT * FROM plans
       WHERE is_active = TRUE
       ORDER BY display_order ASC, price ASC`
    );
    return rows;
  },

  async findById(id) {
    const { rows } = await db.query(
      `SELECT * FROM plans WHERE id = $1`, [id]
    );
    return rows[0] || null;
  },

  /** Slug lookup for URLs like /pricing/premium. */
  async findBySlug(slug) {
    const { rows } = await db.query(
      `SELECT * FROM plans WHERE slug = $1`, [slug]
    );
    return rows[0] || null;
  },

  async create(data) {
    const cols = ['id'];
    const vals = ['$1'];
    const params = [data.id];
    let i = 1;
    for (const key of WRITABLE) {
      if (key in data) {
        i++;
        cols.push(key);
        // features arrives as a JS array; cast to jsonb at the param boundary.
        vals.push(key === 'features' ? `$${i}::jsonb` : `$${i}`);
        params.push(key === 'features' ? JSON.stringify(data[key]) : data[key]);
      }
    }
    const { rows } = await db.query(
      `INSERT INTO plans (${cols.join(', ')}) VALUES (${vals.join(', ')}) RETURNING *`,
      params
    );
    return rows[0];
  },

  async update(id, partial) {
    const sets = [];
    const params = [id];
    for (const key of WRITABLE) {
      if (key in partial) {
        params.push(key === 'features' ? JSON.stringify(partial[key]) : partial[key]);
        sets.push(key === 'features'
          ? `${key} = $${params.length}::jsonb`
          : `${key} = $${params.length}`);
      }
    }
    if (sets.length === 0) return PlanModel.findById(id);
    const { rows } = await db.query(
      `UPDATE plans SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );
    return rows[0] || null;
  },
};

module.exports = PlanModel;
