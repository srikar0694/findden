const express = require('express');
const AdminController = require('../controllers/admin.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/rbac.middleware');

const router = express.Router();

router.use(authenticate, requireRole('admin'));

router.get('/properties', AdminController.listProperties);
router.get('/stats', AdminController.stats);

module.exports = router;
