const express = require('express');
const Joi = require('joi');
const ContactsController = require('../controllers/contacts.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');

const router = express.Router();

const unlockManySchema = Joi.object({
  propertyIds: Joi.array().items(Joi.string().required()).min(1).max(50).required(),
});

router.get('/entitlement', authenticate, ContactsController.entitlement);
router.get('/mine', authenticate, ContactsController.listMine);
router.get('/preview/:propertyId', authenticate, ContactsController.preview);
router.post('/unlock/:propertyId', authenticate, ContactsController.unlock);
router.post('/unlock-many', authenticate, validate(unlockManySchema), ContactsController.unlockMany);

module.exports = router;
