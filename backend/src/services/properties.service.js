const { v4: uuidv4 } = require('uuid');
const PropertyModel = require('../models/property.model');
const PricingService = require('./pricing.service');
const TransactionModel = require('../models/transaction.model');
const { paginate, applyPagination } = require('../utils/pagination');

const PropertiesService = {
  async search(query) {
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
      status: 'active',
    };

    const { rows, total } = PropertyModel.search(filters);
    const { page, limit, offset, meta } = paginate(query, total);
    const paginated = applyPagination(rows, offset, limit);

    return {
      data: paginated.map(formatProperty),
      meta: { ...meta, page, limit },
    };
  },

  getById(id) {
    const property = PropertyModel.findById(id);
    if (!property) return null;
    PropertyModel.incrementViews(id);
    return formatProperty(property);
  },

  async create(ownerId, body) {
    const { paymentRef, ...propertyData } = body;

    // Pricing engine check
    const eligibility = await PricingService.checkPostingEligibility(ownerId, paymentRef);
    if (!eligibility.canPost) {
      throw Object.assign(new Error(eligibility.reason), { code: 'PAYMENT_REQUIRED', statusCode: 402 });
    }

    const property = PropertyModel.create({
      id: uuidv4(),
      owner_id: ownerId,
      ...propertyData,
      status: 'active',
    });

    // Handle quota deduction or pay-per-listing
    if (eligibility.method === 'subscription') {
      await PricingService.deductSubscriptionQuota(
        eligibility.subscription.id,
        eligibility.subscription.plan_id
      );
    } else if (eligibility.method === 'pay_per_listing') {
      await PricingService.verifyPayPerListingPayment(paymentRef, ownerId, property.id);
    }

    return formatProperty(property);
  },

  async update(id, ownerId, role, partial) {
    const property = PropertyModel.findById(id);
    if (!property) return null;
    if (property.owner_id !== ownerId && role !== 'admin') {
      throw Object.assign(new Error('Not authorized to update this property'), { code: 'FORBIDDEN', statusCode: 403 });
    }
    const updated = PropertyModel.update(id, partial);
    return updated ? formatProperty(updated) : null;
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
    return { data: applyPagination(filtered, offset, limit).map(formatProperty), meta };
  },
};

function formatProperty(p) {
  return {
    id: p.id,
    ownerId: p.owner_id,
    title: p.title,
    description: p.description,
    propertyType: p.property_type,
    listingType: p.listing_type,
    status: p.status,
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
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

module.exports = PropertiesService;
