const express = require('express');
const authRoutes = require('./auth.routes');
const propertiesRoutes = require('./properties.routes');
const plansRoutes = require('./plans.routes');
const subscriptionsRoutes = require('./subscriptions.routes');
const paymentsRoutes = require('./payments.routes');
const dashboardRoutes = require('./dashboard.routes');

const router = express.Router();

router.get('/health', (req, res) => res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } }));

router.use('/auth', authRoutes);
router.use('/properties', propertiesRoutes);
router.use('/plans', plansRoutes);
router.use('/subscriptions', subscriptionsRoutes);
router.use('/payments', paymentsRoutes);
router.use('/dashboard', dashboardRoutes);

module.exports = router;
