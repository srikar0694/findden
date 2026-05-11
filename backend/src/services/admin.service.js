const PropertyModel = require('../models/property.model');
const UserModel = require('../models/user.model');
const { paginate, applyPagination } = require('../utils/pagination');

const AdminService = {
  async listProperties(query) {
    const verified    = query.verified    === 'true' ? true : query.verified    === 'false' ? false : undefined;
    const isQuickPost = query.isQuickPost === 'true' ? true : query.isQuickPost === 'false' ? false : undefined;
    const minPrice    = query.minPrice ? parseFloat(query.minPrice) : null;
    const maxPrice    = query.maxPrice ? parseFloat(query.maxPrice) : null;
    const city        = query.city ? query.city.toLowerCase() : null;
    const q           = query.q ? query.q.trim().toLowerCase() : null;

    let allowedOwnerIds = null;
    if (q) {
      const users = await UserModel.findAll();
      allowedOwnerIds = users
        .filter((u) =>
          (u.name  && u.name.toLowerCase().includes(q))  ||
          (u.phone && u.phone.toLowerCase().includes(q)) ||
          (u.email && u.email.toLowerCase().includes(q))
        )
        .map((u) => u.id);
    }

    const { rows: allRows } = await PropertyModel.search({
      verified,
      isQuickPost,
      minPrice,
      maxPrice,
      city,
      status: ['active', 'draft', 'paused', 'sold', 'rented', 'expired', 'pending_payment'],
      includeRecentlySold: false,
      _allowedOwnerIds: allowedOwnerIds,
    });

    const total = allRows.length;
    const { page, limit, offset, meta } = paginate(query, total);
    const paginated = applyPagination(allRows, offset, limit);

    const ownerCache = {};
    const data = await Promise.all(
      paginated.map(async (p) => {
        if (!ownerCache[p.owner_id]) {
          ownerCache[p.owner_id] = await UserModel.findById(p.owner_id);
        }
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
            ? { id: owner.id, name: owner.name, phone: owner.phone, email: owner.email, role: owner.role }
            : null,
          contact: {
            name: p.contact_name || null,
            phone: p.contact_phone || null,
            email: p.contact_email || null,
          },
        };
      })
    );

    return { data, meta: { ...meta, page, limit } };
  },

  async stats() {
    const [all, users] = await Promise.all([
      PropertyModel.findAll(),
      UserModel.findAll(),
    ]);
    return {
      total:      all.length,
      verified:   all.filter((p) => p.verified).length,
      unverified: all.filter((p) => !p.verified).length,
      quickPosts: all.filter((p) => p.is_quick_post).length,
      active:     all.filter((p) => p.status === 'active').length,
      sold:       all.filter((p) => p.status === 'sold' || p.status === 'rented').length,
      totalUsers: users.length,
    };
  },
};

module.exports = AdminService;
