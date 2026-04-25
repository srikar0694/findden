const express = require('express');
const Joi = require('joi');
const MessagesController = require('../controllers/messages.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');

const router = express.Router();

const sendSchema = Joi.object({
  body: Joi.string().min(2).max(2000).required(),
});

router.get('/quota', authenticate, MessagesController.getQuota);
router.get('/contacted', authenticate, MessagesController.contactedProperties);
router.post('/property/:id', authenticate, validate(sendSchema), MessagesController.send);

module.exports = router;
