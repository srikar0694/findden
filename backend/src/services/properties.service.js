/**
 * Properties Service
 * ----------------------------------------------------------------------
 * Business rules:
 *   - Posting a property is ALWAYS FREE. No paywall, no quota, no gateway
 *     call on create().  Monetisation happens on the *buyer* side (contact
 *     unlocks via the Pricing tiers).
 *   - Seller contact details (phone, email) are masked for everyone except:
 *       (a) the owner, or
 *       (b) an admin, or
 *       (c) a user who has an active ContactUnlock for this property.
 */

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

    const { rows, total } = PropertyModel.search(filters);
    const { page, limit, offset, meta } = paginate(query, total);
    const paginated = applyPagination(rows, offset, limit);

    return {
      data: paginated.map((p) => formatProperty(p, viewerId)),
      meta: { ...meta, page, limit },
    };
  },

  /** Mark a property as sold (owner/agent/admin). */
  async markSold(id, userId, role) {
    const property = PropertyModel.findById(id);
    if (!property) return null;
    if (property.owner_id !== userId && role !== 'admin') {
      throw Object.assign(new Error('Not authorized to mark this property as sold'),
        { code: 'FORBIDDEN', statusCode: 403 });
    }
    const updated = PropertyModel.markSold(id);
    return updated ? formatProperty(updated, userId) : null;
  },

  getById(id, viewerId = null) {
    const property = PropertyModel.findById(id);
    if (!property) return null;
    PropertyModel.incrementViews(id);
    return formatProperty(property, viewerId);
  },

  /**
   * Create a property listing.  FREE — no eligibility check, no payment,
   * no quota deduction.  Only requires auth (enforced by the route layer).
   */
  async create(ownerId, body) {
    // Strip any legacy payment field silently — listings are free now.
    // eslint-disable-next-line no-unused-vars
    const { paymentRef, ...propertyData } = body;

    const property = PropertyModel.create({
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

  /**
   * Quick Post — abbreviated create flow per CR §QuickPost.
   * Auto-fills required fields the buyer-facing schema needs (title,
   * description, address) from the limited inputs.
   */
  async quickCreate(ownerId, body) {
    const owner = UserModel.findById(ownerId);
    const cityLabel = body.city || 'My Area';
    const bhkLabel = body.bhk ? `${body.bhk}BHK ` : '';
    const title = `${bhkLabel}${body.property_type[0].toUpperCase()}${body.property_type.slice(1)} in ${cityLabel}`;

    const property = PropertyModel.create({
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
      bathrooms: null,
      area_sqft: null,
      furnishing: 'unfurnished',
      address_line: body.address_line || cityLabel,
      city: cityLabel,
      state: body.state || (owner && owner.state) || '—',
      pincode: body.pincode || '000000',
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

  /** Admin-only — toggle the verified flag. */
  async setVerified(id, adminId, verified) {
    const property = PropertyModel.findById(id);
    if (!property) return null;
    const updated = PropertyModel.update(id, {
      verified: !!verified,
      verified_at: verified ? new Date().toISOString() : null,
      verified_by: verified ? adminId : null,
    });
    return updated ? formatProperty(updated, adminId) : null;
  },

  async update(id, ownerId, role, partial) {
    const property = PropertyModel.findById(id);
    if (!property) return null;
    if (property.owner_id !== ownerId && role !== 'admin') {
      throw Object.assign(new Error('Not authorized to update this property'), { code: 'FORBIDDEN', statusCode: 403 });
    }
    const updated = PropertyModel.update(id, partial);
    return updated ? formatProperty(updated, ownerId) : null;
  },

  async remove(id, userId, role) {
    const property = PropertyModel.findById(id);
    if (!property) return false;
    if (property.owner_id !== userId && role !== 'admin') {
      throw Object.assign(new Error('Not authorized to delete this property'), { code: 'FORBIDDEN', statusCode: 403 });
    }
    return PropertyModel.delete(id);
  },

  getMyListings(ownerId, query) {
    const all = PropertyModel.findByOwnerId(ownerId);
    const filtered = query.status ? all.filter((p) => p.status === query.status) : all;
    filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const { page, limit, offset, meta } = paginate(query, filtered.length);
    return {
      data: applyPagination(filtered, offset, limit).map((p) => formatProperty(p, ownerId)),
      meta,
    };
  },
};

/**
 * Shape a row for API output, masking contact fields when appropriate.
 * Never returns raw phone/email unless the caller is entitled.
 */
function formatProperty(p, viewerId) {
  const isOwner = viewerId && p.owner_id === viewerId;
  const isUnlocked = viewerId ? ContactUnlockModel.hasUnlock(viewerId, p.id) : false;
  const isWishlisted = viewerId ? !!WishlistModel.findByUserAndProperty(viewerId, p.id) : false;

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
    createdAt: p.created_at,
    updatedAt: p.updated_at,

    // --- Viewer-specific projections ---------------------------------------
    isOwner,
    isContactUnlocked: isOwner || isUnlocked,
    isWishlisted,

    // Contact is masked unless owner/unlocked.
    contact: (isOwner || isUnlocked)
      ? {
          phone: p.contact_phone || null,
          email: p.contact_email || null,
          name: p.contact_name || null,
        }
      : maskContact({
          phone: p.contact_phone,
          email: p.contact_email,
          name: p.contact_name,
        }),
  };
}

/** Partially reveal contact info so the UI can hint at a phone/email length. */
function maskContact({ phone, email, name }) {
  const maskedPhone = phone ? phone.slice(0, 2) + '•••••' + phone.slice(-2) : null;
  let maskedEmail = null;
  if (email && email.includes('@')) {
    const [user, domain] = email.split('@');
    maskedEmail = (user.slice(0, 1) + '•••@' + domain);
  }
  return { phone: maskedPhone, email: maskedEmail, name: name ? name.split(' ')[0] : null };
}

module.exports = PropertiesService;
