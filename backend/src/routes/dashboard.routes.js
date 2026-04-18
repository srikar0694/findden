const express = require('express');
const DashboardController = require('../controllers/dashboard.controller');
const { authenticate } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', authenticate, DashboardController.getSummary);

module.exports = router;
