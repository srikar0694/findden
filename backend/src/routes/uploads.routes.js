const express = require('express');
const UploadsController = require('../controllers/uploads.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = express.Router();

router.post('/property-images', authenticate, UploadsController.uploadPropertyImages);

module.exports = router;
