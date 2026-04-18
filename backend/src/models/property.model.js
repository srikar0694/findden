const db = require('../config/database');
const { isInBounds } = require('../utils/geo');

const TABLE = 'properties';

const PropertyModel = {
  findAll: () => db.findAll(TABLE),

  findById: (id) => db.findById(TABLE, id),

  findByOwnerId: (ownerId) => db.findWhere(TABLE, (p) => p.owner_id === ownerId),

  /**
   * Search with filters + optional bounding box.
   * Returns { rows, total } for pagination.
   */
  search: (filters = {}) => {
    const {
      swLat, swLng, neLat, neLng,
      city, listingType, propertyType,
      minPrice, maxPrice, bedrooms, furnishing,
      status = 'active',
    } = filters;

    let rows = db.findWhere(TABLE, (p) => {
      if (p.status !== status) return false;

      // Bounding box filter
      if (swLat != null && swLng != null && neLat != null && neLng != null) {
        if (!isInBounds(p.latitude, p.longitude, swLat, swLng, neLat, neLng)) return false;
      }

      if (city && p.city.toLowerCase() !== city.toLowerCase()) return false;
      if (listingType && p.listing_type !== listingType) return false;
      if (propertyType && p.property_type !== propertyType) return false;
      if (minPrice != null && p.price < Number(minPrice)) return false;
      if (maxPrice != null && p.price > Number(maxPrice)) return false;
      if (bedrooms != null && (p.bedrooms == null || p.bedrooms < Number(bedrooms))) return false;
      if (furnishing && p.furnishing !== furnishing) return false;

      return true;
    });

    // Sort by newest first
    rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return { rows, total: rows.length };
  },

  create: (data) =>
    db.insert(TABLE, {
      ...data,
      views_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),

  update: (id, partial) => db.updateById(TABLE, id, partial),

  incrementViews: (id) => {
    const p = db.findById(TABLE, id);
    if (!p) return null;
    return db.updateById(TABLE, id, { views_count: p.views_count + 1 });
  },

  delete: (id) => db.deleteById(TABLE, id),

  countByOwner: (ownerId, status) =>
    db.count(TABLE, (p) =>
      p.owner_id === ownerId && (status ? p.status === status : true)
    ),

  totalViewsByOwner: (ownerId) =>
    db
      .findWhere(TABLE, (p) => p.owner_id === ownerId)
      .reduce((sum, p) => sum + (p.views_count || 0), 0),
};

module.exports = PropertyModel;
