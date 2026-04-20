const express = require('express');
const Joi = require('joi');
const WishlistController = require('../controllers/wishlist.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');

const router = express.Router();

const addSchema = Joi.object({
  propertyId: Joi.string().required(),
  notes: Joi.string().max(500).optional().allow(null, ''),
});

router.get('/', authenticate, WishlistController.list);
router.post('/', authenticate, validate(addSchema), WishlistController.add);
router.delete('/:propertyId', authenticate, WishlistController.remove);

module.exports = router;
