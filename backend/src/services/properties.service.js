const { v4: uuidv4 } = require('uuid');
const PropertyModel = require('../models/property.model');
const ContactUnlockModel = require('../models/contactUnlock.model');
const WishlistModel = require('../models/wishlist.model');
const UserModel = require('../models/user.model');
const { paginate, applyPagination } = require('../utils/pagination');

const PropertiesService = {
  async search(query, viewerId = null) {
    const filters = {
      swLat: query.swLat ? parseFloat(query.swLat) : null,
      swLng: query.swLng ? parseFloat(query.swLng) : null,
      neLat: query.neLat ? parseFloat(query.neLat) : null,
      neLng: query.neLng ? parseFloat(query.neLng) : null,
      city: query.city || null,
      listingType: query.listingType || null,
      propertyType: query.propertyType || null,
      minPrice: query.minPrice ? parseFloat(query.minPrice) : null,
      maxPrice: query.maxPrice ? parseFloat(query.maxPrice) : null,
      bedrooms: query.bedrooms ? parseInt(query.bedrooms, 10) : null,
      furnishing: query.furnishing || null,
      includeRecentlySold: query.includeSold !== 'false',
      soldVisibilityDays: 2,
      isQuickPost: query.isQuickPost === 'true' ? true : query.isQuickPost === 'false' ? false : undefined,
      verified: query.verified === 'true' ? true : query.verified === 'false' ? false : undefined,
    };

    const { rows, total } = await PropertyModel.search(filters);
    const { page, limit, offset, meta } = paginate(query, total);
    const paginated = applyPagination(rows, offset, limit);

    return {
      data: await Promise.all(paginated.map((p) => formatProperty(p, viewerId))),
      meta: { ...meta, page, limit },
    };
  },

  async markSold(id, userId, role) {
    const property = await PropertyModel.findById(id);
    if (!property) return null;
    if (property.owner_id !== userId && role !== 'admin') {
      throw Object.assign(new Error('Not authorized to mark this property as sold'),
        { code: 'FORBIDDEN', statusCode: 403 });
    }
    const updated = await PropertyModel.markSold(id);
    return updated ? formatProperty(updated, userId) : null;
  },

  async getById(id, viewerId = null) {
    const property = await PropertyModel.findById(id);
    if (!property) return null;
    await PropertyModel.incrementViews(id);
    return formatProperty(property, viewerId);
  },

  async create(ownerId, body) {
    // eslint-disable-next-line no-unused-vars
    const { paymentRef, ...propertyData } = body;
    const property = await PropertyModel.create({
      id: uuidv4(),
      owner_id: ownerId,
      ...propertyData,
      status: 'active',
      verified: false,
      verified_at: null,
      verified_by: null,
      is_quick_post: !!propertyData.is_quick_post,
    });
    return formatProperty(property, ownerId);
  },

  async quickCreate(ownerId, body) {
    const owner = await UserModel.findById(ownerId);
    const cityLabel = body.city || 'My Area';
    const cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : '';
    const listingLabel = (body.listing_type || 'rent').toLowerCase() === 'sale' ? 'Sale' : 'Rent';
    const title = `${cap(body.property_type)} For ${listingLabel} in ${cityLabel}`;

    const property = await PropertyModel.create({
      id: uuidv4(),
      owner_id: ownerId,
      title,
      description: '',
      property_type: body.property_type,
      listing_type: body.listing_type || 'rent',
      status: 'active',
      price: body.price,
      price_negotiable: false,
      bedrooms: body.bhk || null,
      bathrooms: body.bathrooms ?? null,
      area_sqft: body.area_sqft ?? null,
      furnishing: body.furnishing || 'unfurnished',
      room_sharing: body.room_sharing ?? null,
      video_url: body.video_url ?? null,
      address_line: body.address_line || cityLabel,
      country: body.country || 'India',
      city: cityLabel,
      state: body.state || (owner && owner.state) || '—',
      pincode: body.pincode || null,
      latitude: body.latitude,
      longitude: body.longitude,
      images: body.images || [],
      amenities: [],
      available_from: null,
      possession_status: 'ready_to_move',
      nearest_transit: [],
      contact_name: body.owner_name,
      contact_phone: body.contact_phone,
      contact_email: body.contact_email || (owner && owner.email) || null,
      bhk: body.bhk || null,
      verified: false,
      verified_at: null,
      verified_by: null,
      is_quick_post: true,
    });
    return formatProperty(property, ownerId);
  },

  async setVerified(id, adminId, verified) {
    const property = await PropertyModel.findById(id);
    if (!property) return null;
    const updated = await PropertyModel.update(id, {
      verified: !!verified,
      verified_at: verified ? new Date().toISOString() : null,
      verified_by: verified ? adminId : null,
    });
    return updated ? formatProperty(updated, adminId) : null;
  },

  async update(id, ownerId, role, partial) {
    const property = await PropertyModel.findById(id);
    if (!property) return null;
    if (property.owner_id !== ownerId && role !== 'admin') {
      throw Object.assign(new Error('Not authorized to update this property'), { code: 'FORBIDDEN', statusCode: 403 });
    }
    const updated = await PropertyModel.update(id, partial);
    return updated ? formatProperty(updated, ownerId) : null;
  },

  async remove(id, userId, role) {
    const property = await PropertyModel.findById(id);
    if (!property) return false;
    if (property.owner_id !== userId && role !== 'admin') {
      throw Object.assign(new Error('Not authorized to delete this property'), { code: 'FORBIDDEN', statusCode: 403 });
    }
    return PropertyModel.delete(id);
  },

  async getMyListings(ownerId, query) {
    const all = await PropertyModel.findByOwnerId(ownerId);
    const filtered = query.status ? all.filter((p) => p.status === query.status) : all;
    filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const { page, limit, offset, meta } = paginate(query, filtered.length);
    return {
      data: await Promise.all(
        applyPagination(filtered, offset, limit).map((p) => formatProperty(p, ownerId))
      ),
      meta,
    };
  },
};

async function formatProperty(p, viewerId) {
  const isOwner = !!(viewerId && p.owner_id === viewerId);
  const [isUnlocked, isWishlisted] = viewerId
    ? await Promise.all([
        ContactUnlockModel.hasUnlock(viewerId, p.id),
        WishlistModel.findByUserAndProperty(viewerId, p.id).then(Boolean),
      ])
    : [false, false];

  return {
    id: p.id,
    ownerId: p.owner_id,
    title: p.title,
    description: p.description,
    propertyType: p.property_type,
    listingType: p.listing_type,
    status: p.status,
    soldAt: p.sold_at || null,
    price: p.price,
    priceNegotiable: p.price_negotiable,
    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
    areaSqft: p.area_sqft,
    furnishing: p.furnishing,
    floor: p.floor,
    totalFloors: p.total_floors,
    addressLine: p.address_line,
    country: p.country || 'India',
    city: p.city,
    state: p.state,
    pincode: p.pincode,
    latitude: p.latitude,
    longitude: p.longitude,
    images: p.images || [],
    thumbnail: (p.images && p.images[0]) || null,
    amenities: p.amenities || [],
    availableFrom: p.available_from,
    viewsCount: p.views_count,
    possessionStatus: p.possession_status || 'ready_to_move',
    nearestTransit: p.nearest_transit || [],
    verified: !!p.verified,
    verifiedAt: p.verified_at || null,
    isQuickPost: !!p.is_quick_post,
    bhk: p.bhk ?? null,
    videoUrl: p.video_url || null,
    roomSharing: p.room_sharing || null,
    createdAt: p.created_at,
    updatedAt: p.updated_at,

    isOwner,
    isContactUnlocked: isOwner || isUnlocked,
    isWishlisted,

    contact: (isOwner || isUnlocked)
      ? { phone: p.contact_phone || null, email: p.contact_email || null, name: p.contact_name || null }
      : maskContact({ phone: p.contact_phone, email: p.contact_email, name: p.contact_name }),
  };
}

function maskContact({ phone, email, name }) {
  const maskedPhone = phone ? phone.slice(0, 2) + '•••••' + phone.slice(-2) : null;
  let maskedEmail = null;
  if (email && email.includes('@')) {
    const [user, domain] = email.split('@');
    maskedEmail = user.slice(0, 1) + '•••@' + domain;
  }
  return { phone: maskedPhone, email: maskedEmail, name: name ? name.split(' ')[0] : null };
}

module.exports = PropertiesService;
