/**
 * Wishlist — a saved list of properties per user.
 *
 * Row shape: { id, user_id, property_id, notes, added_at }
 *
 * Unique key: (user_id, property_id)
 *
 * The wishlist is free (viewing a property's public details is always free).
 * From the wishlist, a user can select one or many properties and route them
 * into the unlock flow (single-payment OR consume-subscription-quota).
 */

const db = require('../config/database');

const TABLE = 'wishlists';

const WishlistModel = {
  findByUserId: (userId) =>
    db.findWhere(TABLE, (w) => w.user_id === userId)
      .sort((a, b) => new Date(b.added_at) - new Date(a.added_at)),

  findByUserAndProperty: (userId, propertyId) =>
    db.findOne(TABLE, (w) => w.user_id === userId && w.property_id === propertyId),

  countByUser: (userId) => db.count(TABLE, (w) => w.user_id === userId),

  add: ({ id, user_id, property_id, notes = null }) => {
    const existing = WishlistModel.findByUserAndProperty(user_id, property_id);
    if (existing) return existing;
    return db.insert(TABLE, {
      id,
      user_id,
      property_id,
      notes,
      added_at: new Date().toISOString(),
    });
  },

  remove: (userId, propertyId) =>
    db.deleteWhere(TABLE, (w) => w.user_id === userId && w.property_id === propertyId),

  removeById: (id) => db.deleteById(TABLE, id),
};

module.exports = WishlistModel;
