const express = require('express');
const Joi = require('joi');
const NotificationsController = require('../controllers/notifications.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');

const router = express.Router();

const sendMessageSchema = Joi.object({
  message: Joi.string().trim().min(1).max(2000).required(),
});

// Buyer-side actions
router.post('/request-callback/:propertyId', authenticate, NotificationsController.requestCallback);
router.post('/send-message/:propertyId', authenticate, validate(sendMessageSchema), NotificationsController.sendMessage);

// Owner-side inbox
router.get('/inbox', authenticate, NotificationsController.inbox);

module.exports = router;
