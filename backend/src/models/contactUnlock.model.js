/**
 * ContactUnlock — persistent entitlement that lets a user view a seller's
 * contact details for a specific property.
 *
 * Row shape (mirrors the SQL table):
 *   id, user_id, property_id, source ('single'|'cart'|'premium'|'admin_grant'),
 *   subscription_id (nullable), transaction_id, granted_at, expires_at (nullable)
 *
 * Business rules implemented here (read-only logic; write paths go through
 * the payments + contacts services):
 *   - Unlocks are unique per (user_id, property_id) — a second grant is a
 *     no-op that returns the existing row.
 *   - Single-tier unlocks never expire.
 *   - Cart/Premium unlocks inherit the subscription's expires_at, but because
 *     the record is persisted, revoking a subscription still leaves the
 *     historical unlock intact for audit purposes.
 */

const db = require('../config/database');

const TABLE = 'contact_unlocks';

const ContactUnlockModel = {
  findById: (id) => db.findById(TABLE, id),

  findByUserId: (userId) =>
    db.findWhere(TABLE, (u) => u.user_id === userId),

  findByUserAndProperty: (userId, propertyId) =>
    db.findOne(TABLE, (u) => u.user_id === userId && u.property_id === propertyId),

  countByUser: (userId) =>
    db.count(TABLE, (u) => u.user_id === userId),

  /**
   * Grant an unlock if one doesn't already exist.
   * Idempotent — returns the existing row on duplicate.
   */
  grant: (data) => {
    const existing = ContactUnlockModel.findByUserAndProperty(data.user_id, data.property_id);
    if (existing) return existing;
    return db.insert(TABLE, {
      ...data,
      granted_at: new Date().toISOString(),
      expires_at: data.expires_at || null,
    });
  },

  /** Check if a user has an active unlock for a property */
  hasUnlock: (userId, propertyId) => {
    const u = ContactUnlockModel.findByUserAndProperty(userId, propertyId);
    if (!u) return false;
    if (!u.expires_at) return true;
    return new Date(u.expires_at) > new Date();
  },
};

module.exports = ContactUnlockModel;
