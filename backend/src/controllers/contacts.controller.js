const ContactsService = require('../services/contacts.service');
const PricingService = require('../services/pricing.service');
const { success, error, notFound } = require('../utils/response');

const ContactsController = {
  async preview(req, res, next) {
    try {
      const result = await ContactsService.getContactForProperty(
        req.user.id, req.params.propertyId, { consumeQuota: false }
      );
      return success(res, result);
    } catch (err) {
      if (err.code === 'NOT_FOUND') return notFound(res, err.message);
      return next(err);
    }
  },

  async unlock(req, res, next) {
    try {
      const result = await ContactsService.getContactForProperty(
        req.user.id, req.params.propertyId, { consumeQuota: true }
      );
      if (result.status === 'payment_required') {
        return error(res, result.reason, 'PAYMENT_REQUIRED', 402);
      }
      return success(res, result);
    } catch (err) {
      if (err.code === 'NOT_FOUND') return notFound(res, err.message);
      if (err.code === 'PAYMENT_REQUIRED' || err.code === 'QUOTA_EXCEEDED') {
        return error(res, err.message, err.code, 402);
      }
      return next(err);
    }
  },

  async unlockMany(req, res, next) {
    try {
      const { propertyIds = [] } = req.body;
      const result = await ContactsService.unlockMany(req.user.id, propertyIds);
      return success(res, result);
    } catch (err) {
      return next(err);
    }
  },

  async listMine(req, res, next) {
    try {
      const data = await ContactsService.listMyUnlocks(req.user.id);
      return success(res, data);
    } catch (err) {
      return next(err);
    }
  },

  async entitlement(req, res, next) {
    try {
      const ent = await PricingService.getEntitlement(req.user.id);
      return success(res, ent);
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = ContactsController;
