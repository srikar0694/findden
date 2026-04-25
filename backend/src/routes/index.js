const express = require('express');
const authRoutes = require('./auth.routes');
const propertiesRoutes = require('./properties.routes');
const plansRoutes = require('./plans.routes');
const subscriptionsRoutes = require('./subscriptions.routes');
const paymentsRoutes = require('./payments.routes');
const dashboardRoutes = require('./dashboard.routes');
const contactsRoutes = require('./contacts.routes');
const wishlistRoutes = require('./wishlist.routes');
const notificationsRoutes = require('./notifications.routes');
const uploadsRoutes = require('./uploads.routes');
const messagesRoutes = require('./messages.routes');
const adminRoutes = require('./admin.routes');

const router = express.Router();

router.get('/health', (req, res) =>
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } })
);

router.use('/auth', authRoutes);
router.use('/properties', propertiesRoutes);
router.use('/plans', plansRoutes);
router.use('/subscriptions', subscriptionsRoutes);
router.use('/payments', paymentsRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/contacts', contactsRoutes);
router.use('/wishlist', wishlistRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/uploads', uploadsRoutes);
router.use('/messages', messagesRoutes);
router.use('/admin', adminRoutes);

module.exports = router;
