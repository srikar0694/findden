const express = require('express');
const UploadsController = require('../controllers/uploads.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = express.Router();

router.post('/property-images', authenticate, UploadsController.uploadPropertyImages);
router.post('/property-video',  authenticate, UploadsController.uploadPropertyVideo);
// Called when user removes a file or cancels posting — cleans up orphaned R2 objects.
router.delete('/cleanup',       authenticate, UploadsController.cleanupUploads);

module.exports = router;
