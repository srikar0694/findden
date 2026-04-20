const express = require('express');
const Joi = require('joi');
const PlansController = require('../controllers/plans.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/rbac.middleware');
const { validate } = require('../middlewares/validate.middleware');

const router = express.Router();

const planShape = {
  name: Joi.string(),
  slug: Joi.string().valid('single', 'cart', 'premium'),
  description: Joi.string(),
  tagline: Joi.string(),
  price: Joi.number().positive(),
  currency: Joi.string().length(3),
  unlock_quota: Joi.number().integer().positive(),
  duration_days: Joi.number().integer().positive().allow(null),
  billing_cycle: Joi.string().valid('one_time', 'monthly'),
  tier: Joi.string(),
  features: Joi.array().items(Joi.string()),
  highlight: Joi.boolean(),
  display_order: Joi.number().integer().min(0),
  is_active: Joi.boolean(),
};

const createPlanSchema = Joi.object({
  ...planShape,
  name: planShape.name.required(),
  price: planShape.price.required(),
  unlock_quota: planShape.unlock_quota.required(),
  billing_cycle: planShape.billing_cycle.required(),
});
const updatePlanSchema = Joi.object(planShape).min(1);

const quoteSchema = Joi.object({
  size: Joi.number().integer().min(1).max(100).required(),
});

router.get('/', PlansController.getAll);
router.get('/quote', validate(quoteSchema, 'query'), PlansController.quoteCart);
router.get('/:id', PlansController.getById);
router.post('/', authenticate, requireRole('admin'), validate(createPlanSchema), PlansController.create);
router.patch('/:id', authenticate, requireRole('admin'), validate(updatePlanSchema), PlansController.update);

module.exports = router;
