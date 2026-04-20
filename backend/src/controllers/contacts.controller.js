const ContactsService = require('../services/contacts.service');
const PricingService = require('../services/pricing.service');
const { success, error, notFound } = require('../utils/response');

const ContactsController = {
  /** GET /contacts/preview/:propertyId — lightweight "can I unlock?" check */
  preview(req, res, next) {
    try {
      const result = ContactsService.getContactForProperty(
        req.user.id,
        req.params.propertyId,
        { consumeQuota: false }
      );
      return success(res, result);
    } catch (err) {
      if (err.code === 'NOT_FOUND') return notFound(res, err.message);
      return next(err);
    }
  },

  /**
   * POST /contacts/unlock/:propertyId
   * - If the caller has subscription quota, deduct it and return the contact.
   * - If already unlocked, return the contact idempotently.
   * - Otherwise return 402 with a hint to go to Pricing.
   */
  unlock(req, res, next) {
    try {
      const result = ContactsService.getContactForProperty(
        req.user.id,
        req.params.propertyId,
        { consumeQuota: true }
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

  /** POST /contacts/unlock-many  { propertyIds: [...] } */
  unlockMany(req, res, next) {
    try {
      const { propertyIds = [] } = req.body;
      const result = ContactsService.unlockMany(req.user.id, propertyIds);
      return success(res, result);
    } catch (err) {
      return next(err);
    }
  },

  /** GET /contacts/mine — list all properties whose contact I've unlocked */
  listMine(req, res, next) {
    try {
      const data = ContactsService.listMyUnlocks(req.user.id);
      return success(res, data);
    } catch (err) {
      return next(err);
    }
  },

  /** GET /contacts/entitlement — subscription snapshot for badges / paywall */
  entitlement(req, res, next) {
    try {
      const ent = PricingService.getEntitlement(req.user.id);
      return success(res, ent);
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = ContactsController;
