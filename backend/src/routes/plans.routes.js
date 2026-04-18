const express = require('express');
const Joi = require('joi');
const PlansController = require('../controllers/plans.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/rbac.middleware');
const { validate } = require('../middlewares/validate.middleware');

const router = express.Router();

const createPlanSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().optional(),
  price: Joi.number().positive().required(),
  currency: Joi.string().length(3).default('INR'),
  quota: Joi.number().integer().positive().required(),
  duration_days: Joi.number().integer().positive().required(),
  is_active: Joi.boolean().default(true),
});

const updatePlanSchema = Joi.object({
  name: Joi.string(),
  description: Joi.string(),
  price: Joi.number().positive(),
  quota: Joi.number().integer().positive(),
  duration_days: Joi.number().integer().positive(),
  is_active: Joi.boolean(),
}).min(1);

router.get('/', PlansController.getAll);
router.get('/:id', PlansController.getById);
router.post('/', authenticate, requireRole('admin'), validate(createPlanSchema), PlansController.create);
router.patch('/:id', authenticate, requireRole('admin'), validate(updatePlanSchema), PlansController.update);

module.exports = router;
