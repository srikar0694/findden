const express = require('express');
const Joi = require('joi');
const PaymentsController = require('../controllers/payments.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');

const router = express.Router();

const initiateSchema = Joi.object({
  type: Joi.string().valid('subscription', 'pay_per_listing').required(),
  planId: Joi.string().when('type', { is: 'subscription', then: Joi.required() }),
  propertyId: Joi.string().optional(),
});

const verifySchema = Joi.object({
  paymentId: Joi.string().required(),
  orderId: Joi.string().required(),
  signature: Joi.string().optional(),
  type: Joi.string().valid('subscription', 'pay_per_listing').required(),
  planId: Joi.string().optional(),
  propertyId: Joi.string().optional(),
});

router.post('/initiate', authenticate, validate(initiateSchema), PaymentsController.initiatePayment);
router.post('/verify', authenticate, validate(verifySchema), PaymentsController.verifyPayment);
router.get('/history', authenticate, PaymentsController.getHistory);

module.exports = router;
