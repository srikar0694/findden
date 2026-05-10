const { query } = require('../config/database');

// Columns allowed in UPDATE. Generated columns (latitude, longitude, search_doc) are excluded.
const WRITABLE = [
  'title', 'description', 'property_type', 'status', 'listing_type',
  'price', 'price_negotiable', 'bedrooms', 'bathrooms', 'area_sqft', 'furnishing',
  'floor', 'total_floors', 'address_line', 'country', 'city', 'state', 'pincode',
  'images', 'amenities', 'available_from', 'views_count',
  'sold_at', 'verified', 'verified_at', 'verified_by',
  'is_quick_post', 'bhk',
  'contact_name', 'contact_phone', 'contact_email',
  'possession_status', 'nearest_transit',
];

const PropertyModel = {
  async findAll() {
    const { rows } = await query(`SELECT * FROM properties ORDER BY created_at DESC`);
    return rows;
  },

  async findById(id) {
    const { rows } = await query(`SELECT * FROM properties WHERE id = $1`, [id]);
    return rows[0] || null;
  },

  async findByOwnerId(ownerId) {
    const { rows } = await query(
      `SELECT * FROM properties WHERE owner_id = $1 ORDER BY created_at DESC`,
      [ownerId]
    );
    return rows;
  },

  /**
   * Search with SQL-side filtering. Returns { rows, total } over all matches
   * so the service layer can paginate in JS (preserving existing interface).
   */
  async search(filters = {}) {
    const {
      swLat, swLng, neLat, neLng,
      city, listingType, propertyType,
      minPrice, maxPrice, bedrooms, furnishing,
      status,
      includeRecentlySold = true,
      soldVisibilityDays = 2,
      isQuickPost,
      verified,
      _allowedOwnerIds,
    } = filters;

    const conditions = [];
    const params = [];

    const statuses = Array.isArray(status)
      ? status
      : status
        ? [status]
        : (includeRecentlySold ? ['active', 'sold', 'rented'] : ['active']);

    params.push(statuses);
    conditions.push(`status = ANY($${params.length}::property_status[])`);

    if (includeRecentlySold) {
      params.push(soldVisibilityDays);
      conditions.push(
        `(status NOT IN ('sold','rented') OR sold_at >= NOW() - ($${params.length} || ' days')::interval)`
      );
    }

    if (swLat != null && swLng != null && neLat != null && neLng != null) {
      params.push(swLat, neLat, swLng, neLng);
      const i = params.length - 3;
      conditions.push(`latitude BETWEEN $${i} AND $${i + 1}`);
      conditions.push(`longitude BETWEEN $${i + 2} AND $${i + 3}`);
    }

    if (city) {
      params.push(city.toLowerCase());
      conditions.push(`LOWER(city) = $${params.length}`);
    }
    if (listingType) {
      params.push(listingType);
      conditions.push(`listing_type = $${params.length}`);
    }
    if (propertyType) {
      params.push(propertyType);
      conditions.push(`property_type = $${params.length}`);
    }
    if (minPrice != null) {
      params.push(Number(minPrice));
      conditions.push(`price >= $${params.length}`);
    }
    if (maxPrice != null) {
      params.push(Number(maxPrice));
      conditions.push(`price <= $${params.length}`);
    }
    if (bedrooms != null) {
      params.push(Number(bedrooms));
      conditions.push(`bedrooms >= $${params.length}`);
    }
    if (furnishing) {
      params.push(furnishing);
      conditions.push(`furnishing = $${params.length}`);
    }
    if (isQuickPost === true)  conditions.push(`is_quick_post = TRUE`);
    if (isQuickPost === false) conditions.push(`is_quick_post = FALSE`);
    if (verified === true)     conditions.push(`verified = TRUE`);
    if (verified === false)    conditions.push(`verified = FALSE`);

    if (_allowedOwnerIds && _allowedOwnerIds.length > 0) {
      params.push(_allowedOwnerIds);
      conditions.push(`owner_id = ANY($${params.length}::uuid[])`);
    } else if (_allowedOwnerIds && _allowedOwnerIds.length === 0) {
      // No matching owners — short-circuit
      return { rows: [], total: 0 };
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await query(
      `SELECT * FROM properties ${where} ORDER BY created_at DESC`,
      params
    );
    return { rows, total: rows.length };
  },

  async markSold(id) {
    const { rows } = await query(
      `UPDATE properties SET status = 'sold', sold_at = NOW(), updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id]
    );
    return rows[0] || null;
  },

  async markRented(id) {
    const { rows } = await query(
      `UPDATE properties SET status = 'rented', sold_at = NOW(), updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id]
    );
    return rows[0] || null;
  },

  async create(data) {
    const lat = data.latitude ?? null;
    const lng = data.longitude ?? null;
    const { rows } = await query(
      `INSERT INTO properties (
         id, owner_id, title, description, property_type, status, listing_type,
         price, price_negotiable, bedrooms, bathrooms, area_sqft, furnishing,
         floor, total_floors, address_line, country, city, state, pincode, location,
         images, amenities, available_from, views_count,
         sold_at, verified, verified_at, verified_by,
         is_quick_post, bhk, contact_name, contact_phone, contact_email,
         possession_status, nearest_transit
       ) VALUES (
         $1,  $2,  $3,  $4,  $5,  $6,  $7,
         $8,  $9,  $10, $11, $12, $13,
         $14, $15, $16, $17, $18, $19, $20, ST_MakePoint($21, $22)::geography,
         $23, $24, $25, $26,
         $27, $28, $29, $30,
         $31, $32, $33, $34, $35,
         $36, $37
       ) RETURNING *`,
      [
        data.id, data.owner_id, data.title, data.description || null,
        data.property_type, data.status || 'active', data.listing_type,
        data.price, data.price_negotiable ?? false,
        data.bedrooms ?? null, data.bathrooms ?? null, data.area_sqft ?? null, data.furnishing ?? null,
        data.floor ?? null, data.total_floors ?? null,
        data.address_line || '', data.country || 'India', data.city, data.state, data.pincode || null,
        lng, lat,
        data.images || [], data.amenities || [],
        data.available_from ?? null, data.views_count ?? 0,
        data.sold_at ?? null, data.verified ?? false, data.verified_at ?? null, data.verified_by ?? null,
        data.is_quick_post ?? false, data.bhk ?? null,
        data.contact_name ?? null, data.contact_phone ?? null, data.contact_email ?? null,
        data.possession_status || 'ready_to_move', data.nearest_transit || [],
      ]
    );
    return rows[0];
  },

  async update(id, partial) {
    const sets = [];
    const params = [id];

    for (const key of WRITABLE) {
      if (key in partial) {
        params.push(partial[key]);
        sets.push(`${key} = $${params.length}`);
      }
    }

    // Rebuild location if either coordinate changes
    if ('latitude' in partial || 'longitude' in partial) {
      let lat = partial.latitude;
      let lng = partial.longitude;
      if (lat == null || lng == null) {
        const cur = await PropertyModel.findById(id);
        lat = lat ?? cur?.latitude;
        lng = lng ?? cur?.longitude;
      }
      if (lat != null && lng != null) {
        params.push(lng, lat);
        sets.push(`location = ST_MakePoint($${params.length - 1}, $${params.length})::geography`);
      }
    }

    if (sets.length === 0) return PropertyModel.findById(id);
    sets.push('updated_at = NOW()');

    const { rows } = await query(
      `UPDATE properties SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );
    return rows[0] || null;
  },

  async incrementViews(id) {
    await query(
      `UPDATE properties SET views_count = views_count + 1, updated_at = NOW() WHERE id = $1`,
      [id]
    );
  },

  async delete(id) {
    const { rowCount } = await query(`DELETE FROM properties WHERE id = $1`, [id]);
    return rowCount > 0;
  },

  async countByOwner(ownerId, status) {
    const { rows } = await query(
      status
        ? `SELECT COUNT(*)::int AS n FROM properties WHERE owner_id = $1 AND status = $2`
        : `SELECT COUNT(*)::int AS n FROM properties WHERE owner_id = $1`,
      status ? [ownerId, status] : [ownerId]
    );
    return rows[0].n;
  },

  async totalViewsByOwner(ownerId) {
    const { rows } = await query(
      `SELECT COALESCE(SUM(views_count), 0)::int AS total FROM properties WHERE owner_id = $1`,
      [ownerId]
    );
    return rows[0].total;
  },
};

module.exports = PropertyModel;
