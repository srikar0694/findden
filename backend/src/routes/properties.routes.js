const express = require('express');
const Joi = require('joi');
const PropertiesController = require('../controllers/properties.controller');
const { authenticate, optionalAuth } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/rbac.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { PROPERTY_TYPES, LISTING_TYPES, FURNISHING_TYPES, PROPERTY_STATUSES } = require('../config/constants');

const router = express.Router();

// Image references can be either a full URI (e.g. https://images.unsplash.com/…)
// or a path served by our /uploads static handler (e.g. /uploads/properties/…).
const imageRef = Joi.alternatives().try(
  Joi.string().uri(),
  Joi.string().pattern(/^\/uploads\/[\w./-]+$/),
);

const transitItemSchema = Joi.object({
  type: Joi.string().valid('metro', 'bus', 'train', 'airport').required(),
  name: Joi.string().required(),
  distanceKm: Joi.number().min(0).required(),
});

const createPropertySchema = Joi.object({
  title: Joi.string().min(5).max(255).required(),
  description: Joi.string().max(5000).optional(),
  property_type: Joi.string().valid(...PROPERTY_TYPES).required(),
  listing_type: Joi.string().valid(...LISTING_TYPES).required(),
  price: Joi.number().positive().required(),
  price_negotiable: Joi.boolean().default(false),
  bedrooms: Joi.number().integer().min(0).max(20).optional(),
  bathrooms: Joi.number().integer().min(0).max(20).optional(),
  area_sqft: Joi.number().positive().optional(),
  furnishing: Joi.string().valid(...FURNISHING_TYPES).optional(),
  floor: Joi.number().integer().min(0).optional(),
  total_floors: Joi.number().integer().min(1).optional(),
  address_line: Joi.string().required(),
  city: Joi.string().required(),
  state: Joi.string().required(),
  pincode: Joi.string().pattern(/^[0-9]{5,10}$/).required(),
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  images: Joi.array().items(imageRef).default([]),
  amenities: Joi.array().items(Joi.string()).default([]),
  available_from: Joi.string().isoDate().optional(),
  // Project lifecycle: ready_to_move | under_construction | pre_launch | upcoming
  possession_status: Joi.string()
    .valid('ready_to_move', 'under_construction', 'pre_launch', 'upcoming')
    .default('ready_to_move'),
  // Nearest public transport list
  nearest_transit: Joi.array().items(transitItemSchema).default([]),
  // Contact fields the buyer will see after unlocking. Fall back to the
  // owner's own profile phone/email if not provided.
  contact_name: Joi.string().max(120).optional(),
  contact_phone: Joi.string().pattern(/^[0-9+\-\s]{6,20}$/).optional(),
  contact_email: Joi.string().email().optional(),
  bhk: Joi.number().integer().min(1).max(10).optional(),
});

// Quick Post — minimal required fields. Defaults are filled in by the service.
// CR §QuickPost.4 spec field order: owner_name, location pin, phone, price,
// property_type, BHK (if house/apartment/villa).
const quickPostSchema = Joi.object({
  owner_name: Joi.string().min(2).max(120).required(),
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  contact_phone: Joi.string().pattern(/^[0-9+\-\s]{6,20}$/).required(),
  contact_email: Joi.string().email().optional(),
  price: Joi.number().positive().required(),
  property_type: Joi.string().valid(...PROPERTY_TYPES).required(),
  listing_type: Joi.string().valid(...LISTING_TYPES).default('rent'),
  bhk: Joi.number().integer().min(1).max(10).optional(),
  city: Joi.string().optional(),
  state: Joi.string().optional(),
  address_line: Joi.string().optional(),
  pincode: Joi.string().pattern(/^[0-9]{5,10}$/).optional(),
  images: Joi.array().items(imageRef).default([]),
});

const verifySchema = Joi.object({
  verified: Joi.boolean().default(true),
});

const updatePropertySchema = Joi.object({
  title: Joi.string().min(5).max(255),
  description: Joi.string().max(5000),
  price: Joi.number().positive(),
  price_negotiable: Joi.boolean(),
  status: Joi.string().valid(...PROPERTY_STATUSES),
  furnishing: Joi.string().valid(...FURNISHING_TYPES),
  images: Joi.array().items(imageRef),
  amenities: Joi.array().items(Joi.string()),
  available_from: Joi.string().isoDate(),
  contact_name: Joi.string().max(120),
  contact_phone: Joi.string().pattern(/^[0-9+\-\s]{6,20}$/),
  contact_email: Joi.string().email(),
  latitude: Joi.number().min(-90).max(90),
  longitude: Joi.number().min(-180).max(180),
  address_line: Joi.string(),
  city: Joi.string(),
  state: Joi.string(),
  pincode: Joi.string().pattern(/^[0-9]{5,10}$/),
  bhk: Joi.number().integer().min(1).max(10),
}).min(1);

const searchQuerySchema = Joi.object({
  swLat: Joi.number().optional(),
  swLng: Joi.number().optional(),
  neLat: Joi.number().optional(),
  neLng: Joi.number().optional(),
  city: Joi.string().optional(),
  listingType: Joi.string().valid(...LISTING_TYPES).optional(),
  propertyType: Joi.string().valid(...PROPERTY_TYPES).optional(),
  minPrice: Joi.number().optional(),
  maxPrice: Joi.number().optional(),
  bedrooms: Joi.number().integer().min(1).optional(),
  furnishing: Joi.string().valid(...FURNISHING_TYPES).optional(),
  // 'true' (default) keeps recently-sold (≤2 days) in search; 'false' hides them.
  includeSold: Joi.string().valid('true', 'false').optional(),
  // 'true' restricts results to quick-post entries; 'false' or omitted returns
  // the full marketplace including quick posts.
  isQuickPost: Joi.string().valid('true', 'false').optional(),
  // Admin-only filter; ignored in regular search.
  verified: Joi.string().valid('true', 'false').optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

router.get('/', optionalAuth, validate(searchQuerySchema, 'query'), PropertiesController.search);
router.get('/my', authenticate, PropertiesController.getMyListings);
router.get('/:id', optionalAuth, PropertiesController.getById);
router.post('/', authenticate, validate(createPropertySchema), PropertiesController.create);
router.post('/quick', authenticate, validate(quickPostSchema), PropertiesController.quickCreate);
router.patch('/:id', authenticate, validate(updatePropertySchema), PropertiesController.update);
// Owner/admin can mark a property as SOLD OUT — visible for 2 days, then hidden.
router.post('/:id/mark-sold', authenticate, PropertiesController.markSold);
// Admin-only — flip the verified flag (CR §1.4 / Admin Dashboard §2)
router.post('/:id/verify', authenticate, requireRole('admin'), validate(verifySchema), PropertiesController.setVerified);
router.delete('/:id', authenticate, PropertiesController.remove);

module.exports = router;
