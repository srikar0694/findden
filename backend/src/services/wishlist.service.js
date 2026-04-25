const { v4: uuidv4 } = require('uuid');
const WishlistModel = require('../models/wishlist.model');
const PropertyModel = require('../models/property.model');
const ContactUnlockModel = require('../models/contactUnlock.model');
const { WISHLIST_LIMIT } = require('../config/constants');

const WishlistService = {
  list(userId) {
    const items = WishlistModel.findByUserId(userId);
    return items
      .map((w) => {
        const prop = PropertyModel.findById(w.property_id);
        if (!prop) return null;
        return {
          id: w.id,
          propertyId: w.property_id,
          notes: w.notes,
          addedAt: w.added_at,
          isContactUnlocked: ContactUnlockModel.hasUnlock(userId, w.property_id),
          property: {
            id: prop.id,
            title: prop.title,
            city: prop.city,
            state: prop.state,
            price: prop.price,
            listingType: prop.listing_type,
            propertyType: prop.property_type,
            bedrooms: prop.bedrooms,
            bathrooms: prop.bathrooms,
            areaSqft: prop.area_sqft,
            thumbnail: (prop.images && prop.images[0]) || null,
            images: prop.images || [],
            status: prop.status,
            verified: !!prop.verified,
            isQuickPost: !!prop.is_quick_post,
          },
        };
      })
      .filter(Boolean);
  },

  add(userId, propertyId, notes = null) {
    const property = PropertyModel.findById(propertyId);
    if (!property) {
      throw Object.assign(new Error('Property not found'), { code: 'NOT_FOUND', statusCode: 404 });
    }
    const count = WishlistModel.countByUser(userId);
    if (count >= WISHLIST_LIMIT) {
      throw Object.assign(
        new Error(`Wishlist limit (${WISHLIST_LIMIT}) reached`),
        { code: 'LIMIT_REACHED', statusCode: 409 }
      );
    }
    return WishlistModel.add({ id: uuidv4(), user_id: userId, property_id: propertyId, notes });
  },

  remove(userId, propertyId) {
    return WishlistModel.remove(userId, propertyId);
  },

  isWishlisted(userId, propertyId) {
    return !!WishlistModel.findByUserAndProperty(userId, propertyId);
  },
};

module.exports = WishlistService;
