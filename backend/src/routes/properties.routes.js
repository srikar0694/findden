const express = require('express');
const Joi = require('joi');
const PropertiesController = require('../controllers/properties.controller');
const { authenticate, optionalAuth } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { PROPERTY_TYPES, LISTING_TYPES, FURNISHING_TYPES, PROPERTY_STATUSES } = require('../config/constants');

const router = express.Router();

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
  images: Joi.array().items(Joi.string().uri()).default([]),
  amenities: Joi.array().items(Joi.string()).default([]),
  available_from: Joi.string().isoDate().optional(),
  paymentRef: Joi.string().optional(),
});

const updatePropertySchema = Joi.object({
  title: Joi.string().min(5).max(255),
  description: Joi.string().max(5000),
  price: Joi.number().positive(),
  price_negotiable: Joi.boolean(),
  status: Joi.string().valid(...PROPERTY_STATUSES),
  furnishing: Joi.string().valid(...FURNISHING_TYPES),
  images: Joi.array().items(Joi.string().uri()),
  amenities: Joi.array().items(Joi.string()),
  available_from: Joi.string().isoDate(),
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
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

router.get('/', optionalAuth, validate(searchQuerySchema, 'query'), PropertiesController.search);
router.get('/my', authenticate, PropertiesController.getMyListings);
router.get('/:id', optionalAuth, PropertiesController.getById);
router.post('/', authenticate, validate(createPropertySchema), PropertiesController.create);
router.patch('/:id', authenticate, validate(updatePropertySchema), PropertiesController.update);
router.delete('/:id', authenticate, PropertiesController.remove);

module.exports = router;
