const express = require('express');
const Joi = require('joi');
const PaymentsController = require('../controllers/payments.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');

const router = express.Router();

const initiateSchema = Joi.object({
  planId: Joi.string().optional(),
  planSlug: Joi.string().valid('single', 'cart', 'premium').optional(),
  propertyIds: Joi.array().items(Joi.string()).max(30).optional(),
}).or('planId', 'planSlug');

const verifySchema = Joi.object({
  razorpay_order_id: Joi.string().required(),
  razorpay_payment_id: Joi.string().required(),
  razorpay_signature: Joi.string().required(),
  propertyIds: Joi.array().items(Joi.string()).max(30).optional(),
});

// Sandbox helper — only active when RZP SDK is NOT wired.  The frontend calls
// this to produce a valid HMAC for the fake payment event so the verify call
// exercises the real signature check.
const sandboxSignSchema = Joi.object({
  orderId: Joi.string().required(),
  paymentId: Joi.string().required(),
});

router.post('/initiate', authenticate, validate(initiateSchema), PaymentsController.initiatePayment);
router.post('/verify',   authenticate, validate(verifySchema),   PaymentsController.verifyPayment);
router.post('/sandbox-sign', authenticate, validate(sandboxSignSchema), PaymentsController.sandboxSign);
router.get('/history',   authenticate, PaymentsController.getHistory);

module.exports = router;
