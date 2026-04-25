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
   *
   * Updated:
   *   - Includes active AND recently-sold properties (visible for up to
   *     `soldVisibilityDays` — default 2 — then auto-filtered out).
   *   - Supports `includeSold` flag (for dedicated "sold" views).
   *   - Supports `status` being an array for admin views.
   */
  search: (filters = {}) => {
    const {
      swLat, swLng, neLat, neLng,
      city, listingType, propertyType,
      minPrice, maxPrice, bedrooms, furnishing,
      status,                         // string | string[]
      includeRecentlySold = true,     // show sold properties for 2 days
      soldVisibilityDays = 2,
      isQuickPost,                    // boolean | undefined — filter quick posts
      verified,                       // boolean | undefined — admin filter
      ownerName,                      // string | undefined — admin filter
      ownerPhone,                     // string | undefined — admin filter
      ownerEmail,                     // string | undefined — admin filter
    } = filters;

    const soldCutoff = Date.now() - soldVisibilityDays * 24 * 60 * 60 * 1000;
    const statuses = Array.isArray(status)
      ? status
      : status
        ? [status]
        : (includeRecentlySold ? ['active', 'sold', 'rented'] : ['active']);

    let rows = db.findWhere(TABLE, (p) => {
      if (!statuses.includes(p.status)) return false;

      // Hide sold/rented listings older than the visibility window.
      if ((p.status === 'sold' || p.status === 'rented') && includeRecentlySold) {
        const soldAt = p.sold_at ? new Date(p.sold_at).getTime() : 0;
        if (soldAt < soldCutoff) return false;
      }

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
      if (isQuickPost === true && !p.is_quick_post) return false;
      if (isQuickPost === false && p.is_quick_post) return false;
      if (verified === true && !p.verified) return false;
      if (verified === false && p.verified) return false;

      // Owner-side filters (admin dashboard) require a join with users.
      // Implemented in service layer for clarity; model just accepts a
      // pre-resolved list of allowed owner_ids.
      if (filters._allowedOwnerIds && !filters._allowedOwnerIds.includes(p.owner_id)) return false;

      return true;
    });

    // Sort by newest first
    rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return { rows, total: rows.length };
  },

  /**
   * Mark a property as sold (or rented) with a timestamp.
   * Consumers have 2 days of visibility before the record is auto-filtered.
   */
  markSold: (id) => db.updateById(TABLE, id, {
    status: 'sold',
    sold_at: new Date().toISOString(),
  }),

  markRented: (id) => db.updateById(TABLE, id, {
    status: 'rented',
    sold_at: new Date().toISOString(),
  }),

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
