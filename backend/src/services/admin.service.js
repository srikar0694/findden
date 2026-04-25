/**
 * Admin Service
 * --------------------------------------------------------------
 * Powers the admin dashboard (CR §AdminDashboard.1–2):
 *   - List all properties with rich filters (verified status,
 *     price range, city, owner phone/email/name)
 *   - Aggregate stats for the admin overview
 */

const PropertyModel = require('../models/property.model');
const UserModel = require('../models/user.model');
const { paginate, applyPagination } = require('../utils/pagination');

const AdminService = {
  /**
   * Filterable list of every property in the system.
   * Query params:
   *   verified         'true' | 'false'  (omitted = all)
   *   minPrice         number
   *   maxPrice         number
   *   city             string (case-insensitive exact match)
   *   q                string (matches against owner name / phone / email)
   *   isQuickPost      'true' | 'false'
   *   page, limit      pagination
   */
  listProperties(query) {
    const verified = query.verified === 'true' ? true : query.verified === 'false' ? false : undefined;
    const isQuickPost = query.isQuickPost === 'true' ? true : query.isQuickPost === 'false' ? false : undefined;
    const minPrice = query.minPrice ? parseFloat(query.minPrice) : null;
    const maxPrice = query.maxPrice ? parseFloat(query.maxPrice) : null;
    const city = query.city ? query.city.toLowerCase() : null;
    const q = query.q ? query.q.trim().toLowerCase() : null;

    let allowedOwnerIds = null;
    if (q) {
      allowedOwnerIds = UserModel.findAll()
        .filter((u) =>
          (u.name && u.name.toLowerCase().includes(q)) ||
          (u.phone && u.phone.toLowerCase().includes(q)) ||
          (u.email && u.email.toLowerCase().includes(q))
        )
        .map((u) => u.id);
    }

    let rows = PropertyModel.findAll().filter((p) => {
      if (verified === true && !p.verified) return false;
      if (verified === false && p.verified) return false;
      if (isQuickPost === true && !p.is_quick_post) return false;
      if (isQuickPost === false && p.is_quick_post) return false;
      if (minPrice != null && p.price < minPrice) return false;
      if (maxPrice != null && p.price > maxPrice) return false;
      if (city && p.city.toLowerCase() !== city) return false;
      if (allowedOwnerIds && !allowedOwnerIds.includes(p.owner_id)) return false;
      return true;
    });

    rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const total = rows.length;
    const { page, limit, offset, meta } = paginate(query, total);
    const paginated = applyPagination(rows, offset, limit);

    // Enrich with owner info — admins need to see who owns what.
    const ownerCache = {};
    const data = paginated.map((p) => {
      if (!ownerCache[p.owner_id]) ownerCache[p.owner_id] = UserModel.findById(p.owner_id);
      const owner = ownerCache[p.owner_id];
      return {
        id: p.id,
        title: p.title,
        propertyType: p.property_type,
        listingType: p.listing_type,
        status: p.status,
        price: p.price,
        bedrooms: p.bedrooms,
        bhk: p.bhk ?? null,
        city: p.city,
        state: p.state,
        thumbnail: (p.images && p.images[0]) || null,
        verified: !!p.verified,
        verifiedAt: p.verified_at || null,
        isQuickPost: !!p.is_quick_post,
        viewsCount: p.views_count,
        createdAt: p.created_at,
        owner: owner
          ? {
              id: owner.id,
              name: owner.name,
              phone: owner.phone,
              email: owner.email,
              role: owner.role,
            }
          : null,
        contact: {
          name: p.contact_name || null,
          phone: p.contact_phone || null,
          email: p.contact_email || null,
        },
      };
    });

    return { data, meta: { ...meta, page, limit } };
  },

  /** Quick aggregate stats for the admin overview. */
  stats() {
    const all = PropertyModel.findAll();
    return {
      total: all.length,
      verified: all.filter((p) => p.verified).length,
      unverified: all.filter((p) => !p.verified).length,
      quickPosts: all.filter((p) => p.is_quick_post).length,
      active: all.filter((p) => p.status === 'active').length,
      sold: all.filter((p) => p.status === 'sold' || p.status === 'rented').length,
      totalUsers: UserModel.findAll().length,
    };
  },
};

module.exports = AdminService;
