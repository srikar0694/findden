const express = require('express');
const UploadsController = require('../controllers/uploads.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = express.Router();

router.post('/property-images', authenticate, UploadsController.uploadPropertyImages);
router.post('/property-video',  authenticate, UploadsController.uploadPropertyVideo);

module.exports = router;
