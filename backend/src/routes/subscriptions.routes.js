const express = require('express');
const Joi = require('joi');
const SubscriptionsController = require('../controllers/subscriptions.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');

const router = express.Router();

const subscribeSchema = Joi.object({
  planId: Joi.string().required(),
  paymentRef: Joi.string().required(),
});

const upgradeSchema = Joi.object({
  newPlanId: Joi.string().required(),
  paymentRef: Joi.string().required(),
});

router.post('/', authenticate, validate(subscribeSchema), SubscriptionsController.subscribe);
router.get('/me', authenticate, SubscriptionsController.getMySubscription);
router.get('/history', authenticate, SubscriptionsController.getHistory);
router.post('/:id/upgrade', authenticate, validate(upgradeSchema), SubscriptionsController.upgrade);
router.post('/:id/cancel', authenticate, SubscriptionsController.cancel);

module.exports = router;
